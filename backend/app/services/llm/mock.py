"""Deterministic mock LLM — no external dependencies.

Used in two cases:
  * Local development before Ollama / OpenRouter is wired up.
  * Tests — output is reproducible so we can assert on it.

The "response" is shaped from the prompt, so it's still useful for
verifying the streaming plumbing without burning a token.
"""
from __future__ import annotations

import asyncio
from typing import AsyncIterator

from app.services.llm.base import LLMProvider, LLMStreamChunk


def _canned_response(prompt: str) -> str:
    head = prompt.strip().splitlines()[0][:120] if prompt.strip() else "your request"
    return (
        f"Here is a mock copilot response for: {head}\n"
        "- This is a deterministic stub so the streaming pipeline can be verified.\n"
        "- Configure AI_PROVIDER=ollama or openrouter for real generation."
    )


class MockProvider(LLMProvider):
    name = "mock"

    async def stream(
        self,
        *,
        system: str | None,  # noqa: ARG002 — accepted for interface parity
        prompt: str,
        model: str,  # noqa: ARG002
    ) -> AsyncIterator[LLMStreamChunk]:
        text = _canned_response(prompt)
        prompt_tokens = max(1, len(prompt) // 4)
        completion_tokens = 0
        # Emit one word at a time with a tiny delay so the SSE client
        # actually observes streaming behaviour.
        for word in text.split(" "):
            await asyncio.sleep(0.005)
            chunk = word + " "
            completion_tokens += 1
            yield LLMStreamChunk(content=chunk)
        yield LLMStreamChunk(
            content="",
            done=True,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
