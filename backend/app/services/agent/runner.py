"""Agentic copilot — bounded tool-calling loop.

Asks the LLM for either a final answer or a single tool invocation, runs
the tool, feeds the result back, and repeats up to ``max_steps``. Every
step is recorded so callers (and the UI) can render the trace.

Tool invocation format:
The LLM is instructed to emit a single line of the form
    [tool: NAME] {"json": "arguments"}
when it wants to call a tool. If no such line is present, the response
is treated as the final answer. This is provider-agnostic — when a real
provider is wired up with native tool calls, the parser can be swapped
for the provider's structured tool-use API without changing this loop.
"""
from __future__ import annotations

import json
import re
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.agent.tools import get_tool, tools_summary
from app.services.llm import LLMProvider, get_provider

_TOOL_LINE_RE = re.compile(r"\[tool:\s*([A-Za-z0-9_]+)\s*\]\s*(\{.*\})?", re.DOTALL)


@dataclass
class AgentStep:
    kind: str  # "tool_call" or "final"
    tool: str | None = None
    arguments: dict | None = None
    result: Any = None
    text: str = ""


@dataclass
class AgentRun:
    steps: list[AgentStep] = field(default_factory=list)
    final_answer: str = ""


def _build_system(extra: str | None) -> str:
    base = (
        "You are an agentic doc copilot. You have access to these tools:\n"
        f"{tools_summary()}\n\n"
        "Decision rules:\n"
        "1. If a tool would help, reply with EXACTLY one line:\n"
        '   [tool: NAME] {"arg": "value"}\n'
        "2. Otherwise reply with a normal answer for the user.\n"
        "Never call more than one tool per turn."
    )
    if extra:
        base = f"{base}\n\n---\nContext:\n{extra}"
    return base


async def _ask(provider, system: str, user_prompt: str) -> str:
    chunks: list[str] = []
    async for chunk in provider.stream(system=system, prompt=user_prompt, model=settings.ai_model):
        if chunk.done:
            break
        if chunk.content:
            chunks.append(chunk.content)
    return "".join(chunks)


class AgentRunner:
    """Bounded tool-calling loop."""

    def __init__(self, *, max_steps: int = 5, provider: LLMProvider | None = None) -> None:
        self.max_steps = max_steps
        self._provider = provider

    async def run(
        self,
        *,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        prompt: str,
        context: str | None = None,
    ) -> AgentRun:
        provider = self._provider or get_provider()
        run = AgentRun()
        scratch_prompt = prompt

        for step in range(self.max_steps):
            system = _build_system(context)
            reply = await _ask(provider, system, scratch_prompt)
            match = _TOOL_LINE_RE.search(reply)
            if not match:
                run.steps.append(AgentStep(kind="final", text=reply.strip()))
                run.final_answer = reply.strip()
                return run

            tool_name = match.group(1)
            raw_args = match.group(2) or "{}"
            try:
                arguments = json.loads(raw_args)
            except json.JSONDecodeError:
                arguments = {}

            tool = get_tool(tool_name)
            if tool is None:
                err = {"error": f"unknown tool '{tool_name}'"}
                run.steps.append(
                    AgentStep(kind="tool_call", tool=tool_name, arguments=arguments, result=err)
                )
                scratch_prompt = (
                    f"Tool error: {err['error']}.\nOriginal request: {prompt}"
                )
                continue

            try:
                result = await tool.handler(db, workspace_id, arguments)
            except Exception as exc:  # noqa: BLE001 — surface to the agent loop
                result = {"error": str(exc)}

            run.steps.append(
                AgentStep(
                    kind="tool_call",
                    tool=tool_name,
                    arguments=arguments,
                    result=result,
                )
            )
            scratch_prompt = (
                f"Tool {tool_name} returned: {json.dumps(result)[:1200]}\n"
                f"Original request: {prompt}\nNow produce a concise final answer."
            )

        # Max steps reached without a final answer — synthesize one from the
        # last tool result so the caller never gets an empty response.
        last = run.steps[-1] if run.steps else None
        run.final_answer = (
            f"Reached step limit. Last tool {last.tool!r} returned: {json.dumps(last.result)[:400]}"
            if last and last.kind == "tool_call"
            else "Reached step limit with no result."
        )
        return run

    @staticmethod
    def as_dict(run: AgentRun) -> dict:
        return {
            "final_answer": run.final_answer,
            "steps": [asdict(s) for s in run.steps],
        }
