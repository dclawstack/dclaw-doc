"""Doc-copilot orchestration.

Builds a streaming response from the configured LLM provider, optionally
grounded in RAG hits. Citations are streamed alongside tokens so the UI
can render footnotes that point at the exact source chunks.
"""
from __future__ import annotations

import json
import uuid
from dataclasses import asdict
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import is_enabled, settings
from app.repositories.documents import DocumentRepository
from app.services.llm import LLMStreamChunk, get_provider
from app.services.rag import SearchHit, hybrid_search
from app.services.usage import record_usage


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
        "answer the user's question. When you draw on context, cite the "
        "[#] markers in line. If the context doesn't cover it, say so."
    ),
}


def sse_event(event_type: str, payload: dict | str) -> str:
    if isinstance(payload, str):
        payload = {"content": payload}
    return f"event: {event_type}\ndata: {json.dumps(payload, default=str)}\n\n"


def _format_citations_for_prompt(hits: list[SearchHit]) -> str:
    lines = []
    for idx, hit in enumerate(hits, start=1):
        snippet = hit.text.strip().replace("\n", " ")[:400]
        lines.append(f"[{idx}] {hit.document_title} :: {snippet}")
    return "\n".join(lines)


async def stream_doc_chat(
    *,
    db: AsyncSession,
    workspace_id: uuid.UUID,
    document_id: uuid.UUID | None,
    selection: str | None,
    prompt: str,
    mode: str,
    use_rag: bool = True,
) -> AsyncIterator[str]:
    """Stream SSE frames for a doc-chat request.

    Frame sequence:
      ``meta``       — model + provider name (first frame)
      ``citations``  — RAG hits with chunk metadata (when use_rag and hits exist)
      ``token`` × N  — content deltas
      ``usage``      — final token counts (best-effort)
      ``done``       — terminal
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

    hits: list[SearchHit] = []
    if use_rag and is_enabled("rag"):
        try:
            hits = await hybrid_search(db, workspace_id=workspace_id, query=prompt)
        except Exception:  # noqa: BLE001 — RAG is best-effort grounding
            hits = []

    if hits:
        system = (
            f"{system}\n\n---\nRelevant context (cite with [#]):\n"
            f"{_format_citations_for_prompt(hits)}"
        )

    user_prompt = prompt
    if selection:
        user_prompt = f"Selected text:\n{selection}\n\nInstruction: {prompt}"

    provider = get_provider()
    yield sse_event(
        "meta",
        {"provider": provider.name, "model": settings.ai_model, "rag_hits": len(hits)},
    )

    if hits:
        yield sse_event(
            "citations",
            {"citations": [asdict(h) for h in hits]},
        )

    final_chunk: LLMStreamChunk | None = None
    async for chunk in provider.stream(system=system, prompt=user_prompt, model=settings.ai_model):
        if chunk.done:
            final_chunk = chunk
            break
        if chunk.content:
            yield sse_event("token", {"content": chunk.content})

    if final_chunk is not None:
        if is_enabled("usage"):
            try:
                await record_usage(
                    db,
                    workspace_id=workspace_id,
                    provider=provider.name,
                    model=settings.ai_model,
                    prompt_tokens=final_chunk.prompt_tokens or 0,
                    completion_tokens=final_chunk.completion_tokens or 0,
                )
            except Exception:  # noqa: BLE001 — telemetry must never break the stream
                pass
        yield sse_event(
            "usage",
            {
                "prompt_tokens": final_chunk.prompt_tokens,
                "completion_tokens": final_chunk.completion_tokens,
            },
        )
    yield sse_event("done", {})
