"""Retrieval-augmented generation: chunking, embedding, hybrid search.

Chunking is paragraph-based with a soft cap; embeddings are stored as
JSON arrays so the same code path works on SQLite and Postgres. Search
combines keyword overlap with cosine similarity for a simple but real
hybrid ranker.
"""
from __future__ import annotations

import json
import math
import re
import uuid
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.services.embeddings import EmbeddingProvider, get_embedding_provider


_MAX_CHARS_PER_CHUNK = 800


def chunk_text(text: str) -> list[str]:
    """Split text into ~paragraph-sized chunks under a soft char cap."""
    if not text.strip():
        return []
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    chunks: list[str] = []
    buffer: list[str] = []
    buffer_len = 0
    for para in paragraphs:
        if buffer_len + len(para) + 2 > _MAX_CHARS_PER_CHUNK and buffer:
            chunks.append("\n\n".join(buffer))
            buffer = []
            buffer_len = 0
        if len(para) > _MAX_CHARS_PER_CHUNK:
            # split long paragraph into hard slices
            for start in range(0, len(para), _MAX_CHARS_PER_CHUNK):
                chunks.append(para[start : start + _MAX_CHARS_PER_CHUNK])
            continue
        buffer.append(para)
        buffer_len += len(para) + 2
    if buffer:
        chunks.append("\n\n".join(buffer))
    return chunks


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


def keyword_overlap(query: str, text: str) -> float:
    """Cheap BM25-ish surrogate: Jaccard over lowercased tokens."""
    q_tokens = {t.lower() for t in _TOKEN_RE.findall(query) if len(t) > 2}
    if not q_tokens:
        return 0.0
    t_tokens = {t.lower() for t in _TOKEN_RE.findall(text) if len(t) > 2}
    if not t_tokens:
        return 0.0
    return len(q_tokens & t_tokens) / len(q_tokens | t_tokens)


@dataclass
class SearchHit:
    document_id: uuid.UUID
    chunk_id: uuid.UUID
    ordinal: int
    text: str
    score: float
    document_title: str


async def reindex_document(db: AsyncSession, document: Document) -> int:
    """Replace all chunks for a document with freshly embedded ones."""
    await db.execute(
        delete(DocumentChunk).where(DocumentChunk.document_id == document.id)
    )

    pieces = chunk_text(document.content_md or "")
    if not pieces:
        await db.commit()
        return 0

    provider: EmbeddingProvider = get_embedding_provider()
    vectors = await provider.embed(pieces)

    for ordinal, (text, vec) in enumerate(zip(pieces, vectors)):
        db.add(
            DocumentChunk(
                document_id=document.id,
                workspace_id=document.workspace_id,
                ordinal=ordinal,
                text=text,
                embedding=json.dumps(vec),
                embedding_model=f"{provider.name}:{provider.model}",
            )
        )
    await db.commit()
    return len(pieces)


async def hybrid_search(
    db: AsyncSession,
    *,
    workspace_id: uuid.UUID,
    query: str,
    top_k: int | None = None,
) -> list[SearchHit]:
    """Return top-k chunks blending keyword overlap + cosine similarity."""
    if not query.strip():
        return []

    provider = get_embedding_provider()
    query_vec = (await provider.embed([query]))[0]

    stmt = (
        select(DocumentChunk, Document.title)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(
            DocumentChunk.workspace_id == workspace_id,
            Document.deleted_at.is_(None),
        )
    )
    rows = (await db.execute(stmt)).all()

    scored: list[SearchHit] = []
    for chunk, title in rows:
        try:
            chunk_vec = json.loads(chunk.embedding)
        except (TypeError, ValueError):
            continue
        sim = cosine(query_vec, chunk_vec)
        kw = keyword_overlap(query, chunk.text)
        score = 0.7 * sim + 0.3 * kw
        scored.append(
            SearchHit(
                document_id=chunk.document_id,
                chunk_id=chunk.id,
                ordinal=chunk.ordinal,
                text=chunk.text,
                score=score,
                document_title=title,
            )
        )
    scored.sort(key=lambda h: h.score, reverse=True)
    return scored[: (top_k or settings.rag_top_k)]
