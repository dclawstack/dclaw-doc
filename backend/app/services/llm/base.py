from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator


@dataclass
class LLMStreamChunk:
    """One delta from a streaming LLM call.

    ``content`` is the new text fragment. ``done`` is True on the terminal
    chunk and carries cumulative token counts when the provider reports
    them.
    """

    content: str
    done: bool = False
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class LLMProvider(ABC):
    """Minimal streaming-completion provider interface."""

    name: str

    @abstractmethod
    async def stream(
        self,
        *,
        system: str | None,
        prompt: str,
        model: str,
    ) -> AsyncIterator[LLMStreamChunk]:
        """Yield ``LLMStreamChunk`` deltas, ending with ``done=True``."""
        raise NotImplementedError
