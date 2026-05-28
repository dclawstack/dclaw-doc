"""Doc-copilot orchestration.

Given an optional document + user prompt + mode, produce a streaming
response built from the configured LLM provider. Document context is
injected as the system prompt so the model can reason about it.
"""
from __future__ import annotations

import json
import uuid
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.documents import DocumentRepository
from app.services.llm import LLMStreamChunk, get_provider


SYSTEM_PROMPTS = {
    "rewrite": (
        "You are a writing assistant. Rewrite the user's selection to be "
        "clearer, more concise, and grammatically correct. Preserve meaning."
    ),
    "summarize": (
        "You are a writing assistant. Summarize the user's selection in "
        "three bullet points. Be faithful to the source."
    ),
    "translate": (
        "You are a writing assistant. Translate the user's selection to "
        "English, preserving structure and tone."
    ),
    "explain": (
        "You are a writing assistant. Explain the user's selection in "
        "plain language to a non-expert."
    ),
    "chat": (
        "You are a doc-aware copilot. Use any provided document context to "
        "answer the user's question. If the context doesn't cover it, say so."
    ),
}


def sse_event(event_type: str, payload: dict | str) -> str:
    """Format a Server-Sent Events frame.

    Always sends a single ``data:`` line carrying JSON.
    """
    if isinstance(payload, str):
        payload = {"content": payload}
    return f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"


async def stream_doc_chat(
    *,
    db: AsyncSession,
    workspace_id: uuid.UUID,
    document_id: uuid.UUID | None,
    selection: str | None,
    prompt: str,
    mode: str,
) -> AsyncIterator[str]:
    """Stream SSE frames for a doc-chat request.

    Frame sequence:
      ``event: meta`` — model + provider name (first frame)
      ``event: token`` × N — content deltas
      ``event: usage`` — final token counts (best-effort)
      ``event: done`` — terminal
    """
    system = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["chat"])

    if document_id is not None:
        repo = DocumentRepository(db)
        doc = await repo.get_for_workspace(workspace_id, document_id)
        if doc is not None:
            system = (
                f"{system}\n\n"
                f"---\nCurrent document title: {doc.title}\n"
                f"Current document content:\n{doc.content_md or '(empty)'}"
            )

    user_prompt = prompt
    if selection:
        user_prompt = f"Selected text:\n{selection}\n\nInstruction: {prompt}"

    provider = get_provider()
    yield sse_event("meta", {"provider": provider.name, "model": settings.ai_model})

    final_chunk: LLMStreamChunk | None = None
    async for chunk in provider.stream(system=system, prompt=user_prompt, model=settings.ai_model):
        if chunk.done:
            final_chunk = chunk
            break
        if chunk.content:
            yield sse_event("token", {"content": chunk.content})

    if final_chunk is not None:
        yield sse_event(
            "usage",
            {
                "prompt_tokens": final_chunk.prompt_tokens,
                "completion_tokens": final_chunk.completion_tokens,
            },
        )
    yield sse_event("done", {})
