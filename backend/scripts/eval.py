#!/usr/bin/env python
"""AI eval harness.

Runs every YAML case under ``tests/evals/`` through the configured LLM
provider and asserts ``must_include`` / ``must_not_include`` rules
against the full streamed reply.

Usage:
    python scripts/eval.py
    python scripts/eval.py --evals-dir tests/evals --out evals_report.json
    AI_PROVIDER=openrouter python scripts/eval.py  # switch to real model

Exit code is non-zero if any case fails — wire this into CI to gate
merges on regressions.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import yaml

# Allow running from anywhere
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.core.config import settings  # noqa: E402
from app.services.llm import get_provider  # noqa: E402
from app.services.llm.base import LLMStreamChunk  # noqa: E402


@dataclass
class EvalCase:
    id: str
    mode: str
    prompt: str
    must_include: list[str] = field(default_factory=list)
    must_not_include: list[str] = field(default_factory=list)
    context: str | None = None


@dataclass
class EvalResult:
    case_id: str
    passed: bool
    response: str
    failures: list[str]
    latency_ms: float
    prompt_tokens: int | None
    completion_tokens: int | None


SYSTEM_PROMPTS = {
    "summarize": "Summarize the user's input in three bullet points.",
    "rewrite": "Rewrite the user's input for clarity.",
    "translate": "Translate the user's input to English.",
    "explain": "Explain the user's input simply.",
    "chat": "Answer the user's question using any provided context.",
}


def _load_cases(evals_dir: Path) -> list[EvalCase]:
    cases: list[EvalCase] = []
    for path in sorted(evals_dir.glob("**/*.yaml")):
        data = yaml.safe_load(path.read_text()) or []
        for raw in data:
            cases.append(
                EvalCase(
                    id=raw["id"],
                    mode=raw.get("mode", "chat"),
                    prompt=raw["prompt"],
                    must_include=raw.get("must_include", []) or [],
                    must_not_include=raw.get("must_not_include", []) or [],
                    context=raw.get("context"),
                )
            )
    return cases


async def _run_one(case: EvalCase) -> EvalResult:
    provider = get_provider()
    system = SYSTEM_PROMPTS.get(case.mode, SYSTEM_PROMPTS["chat"])
    if case.context:
        system = f"{system}\n\n---\nContext:\n{case.context}"

    response_parts: list[str] = []
    started = time.perf_counter()
    final: LLMStreamChunk | None = None
    async for chunk in provider.stream(system=system, prompt=case.prompt, model=settings.ai_model):
        if chunk.done:
            final = chunk
            break
        if chunk.content:
            response_parts.append(chunk.content)

    latency_ms = (time.perf_counter() - started) * 1000.0
    response = "".join(response_parts)

    failures: list[str] = []
    for needle in case.must_include:
        if needle not in response:
            failures.append(f"missing required substring: {needle!r}")
    for needle in case.must_not_include:
        if needle in response:
            failures.append(f"contained forbidden substring: {needle!r}")

    return EvalResult(
        case_id=case.id,
        passed=not failures,
        response=response,
        failures=failures,
        latency_ms=round(latency_ms, 2),
        prompt_tokens=final.prompt_tokens if final else None,
        completion_tokens=final.completion_tokens if final else None,
    )


def _git_sha() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


async def _main() -> int:
    parser = argparse.ArgumentParser(description="DClaw Doc AI eval harness")
    parser.add_argument("--evals-dir", default="tests/evals", type=Path)
    parser.add_argument("--out", default="evals_report.json", type=Path)
    args = parser.parse_args()

    evals_dir = ROOT / args.evals_dir if not args.evals_dir.is_absolute() else args.evals_dir
    cases = _load_cases(evals_dir)
    if not cases:
        print(f"No eval cases found under {evals_dir}", file=sys.stderr)
        return 2

    provider = get_provider()
    print(f"Running {len(cases)} cases via {provider.name} ({settings.ai_model})")

    results = [await _run_one(c) for c in cases]

    report = {
        "git_sha": _git_sha(),
        "provider": provider.name,
        "model": settings.ai_model,
        "ai_provider_env": os.environ.get("AI_PROVIDER", settings.ai_provider),
        "total": len(results),
        "passed": sum(1 for r in results if r.passed),
        "failed": sum(1 for r in results if not r.passed),
        "results": [r.__dict__ for r in results],
    }
    out_path = ROOT / args.out if not args.out.is_absolute() else args.out
    out_path.write_text(json.dumps(report, indent=2))

    print(f"Passed {report['passed']}/{report['total']} (report → {out_path})")
    for r in results:
        if r.passed:
            print(f"  ✔ {r.case_id} ({r.latency_ms} ms)")
        else:
            print(f"  ✘ {r.case_id} ({r.latency_ms} ms)")
            for f in r.failures:
                print(f"      - {f}")

    return 0 if report["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
