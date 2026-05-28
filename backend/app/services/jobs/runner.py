"""In-process async job runner.

This is the minimum viable Arq-shape: a coroutine queue dispatched by an
asyncio task; status is persisted in the ``jobs`` table so HTTP callers
can poll ``GET /api/v1/jobs/{id}``. Swap to a real Arq worker by
pointing ``enqueue`` at a redis-backed queue and keeping the same
handler signatures.

Why not just fire-and-forget background tasks?
- Survives a long-running AI call (re-embed, translate 50 pages, etc.)
  without blocking the request response
- One row per job → traceability; ``status`` exposed to UI
- Same code path works locally (asyncio queue) and in prod (Arq + Redis)
  by swapping the queue backend
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import uuid
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.core.logging import get_logger
from app.core.utils import utc_now
from app.models.job import Job


@dataclass
class JobContext:
    job_id: uuid.UUID
    workspace_id: uuid.UUID
    payload: dict


JobHandler = Callable[[AsyncSession, JobContext], Awaitable[dict | None]]

_handlers: dict[str, JobHandler] = {}
_queue: asyncio.Queue[uuid.UUID] | None = None
_worker_task: asyncio.Task | None = None


def job_handler(kind: str) -> Callable[[JobHandler], JobHandler]:
    """Decorator: ``@job_handler("kind") async def handler(session, ctx): ...``"""

    def decorate(fn: JobHandler) -> JobHandler:
        _handlers[kind] = fn
        return fn

    return decorate


async def enqueue(
    db: AsyncSession,
    *,
    workspace_id: uuid.UUID,
    kind: str,
    payload: dict,
    enqueued_by: str,
) -> Job:
    if kind not in _handlers:
        raise ValueError(f"unknown job kind: {kind}")
    job = Job(
        workspace_id=workspace_id,
        kind=kind,
        payload=json.dumps(payload or {}),
        enqueued_by=enqueued_by,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    # The worker is started by the app lifespan. If it's running, schedule
    # the job for async execution; otherwise (e.g. tests) the caller is
    # expected to drive execution via ``run_job_now``.
    if _queue is not None and _worker_task is not None and not _worker_task.done():
        _queue.put_nowait(job.id)
    return job


async def start_worker() -> None:
    """Spin up the background queue + worker task.

    Idempotent. Called from the FastAPI lifespan so production traffic
    gets async execution; tests skip this and use ``run_job_now``.
    """
    await _ensure_worker()


async def run_job_now(db: AsyncSession, job: Job) -> Job:
    """Execute a job synchronously — used by tests so behaviour is deterministic."""
    return await _execute(db, job.id)


async def _ensure_worker() -> None:
    global _queue, _worker_task
    if _queue is None:
        _queue = asyncio.Queue()
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(_worker_loop(_queue), name="dclaw-job-worker")


async def _worker_loop(queue: asyncio.Queue[uuid.UUID]) -> None:
    log = get_logger("jobs.worker")
    while True:
        job_id = await queue.get()
        try:
            async with AsyncSession(engine, expire_on_commit=False) as session:
                await _execute(session, job_id)
        except Exception as exc:  # noqa: BLE001
            log.error("jobs.worker_failed", job_id=str(job_id), error=str(exc))
        finally:
            queue.task_done()


async def _execute(db: AsyncSession, job_id: uuid.UUID) -> Job:
    job = await db.get(Job, job_id)
    if job is None:
        raise LookupError(f"Job {job_id} disappeared before execution")

    handler = _handlers.get(job.kind)
    if handler is None:
        job.status = "failed"
        job.error = f"no handler for kind={job.kind!r}"
        job.finished_at = utc_now()
        await db.commit()
        return job

    job.status = "running"
    job.started_at = utc_now()
    await db.commit()

    try:
        payload = json.loads(job.payload or "{}")
        ctx = JobContext(job_id=job.id, workspace_id=job.workspace_id, payload=payload)
        result = await handler(db, ctx)
        job.result = json.dumps(result or {})
        job.status = "succeeded"
    except Exception as exc:  # noqa: BLE001
        job.error = str(exc)
        job.status = "failed"
    finally:
        job.finished_at = utc_now()
        await db.commit()
    await db.refresh(job)
    return job


# --- Default handlers ---

@job_handler("doc.reindex_all")
async def _reindex_all(db: AsyncSession, ctx: JobContext) -> dict:
    """Re-embed every document in the workspace.

    Useful after switching the embedding provider or chunking strategy.
    """
    from app.models.document import Document
    from app.services.rag import reindex_document
    from sqlalchemy import select

    stmt = select(Document).where(Document.workspace_id == ctx.workspace_id)
    docs = list((await db.execute(stmt)).scalars().all())
    total = 0
    for doc in docs:
        total += await reindex_document(db, doc)
    return {"documents": len(docs), "chunks": total}


@job_handler("doc.translate")
async def _translate(db: AsyncSession, ctx: JobContext) -> dict:
    """Translate one document in-place by id, target_language."""
    from app.repositories.documents import DocumentRepository
    from app.services.translation import translate_markdown

    doc_id_str = str(ctx.payload.get("document_id") or "")
    target = str(ctx.payload.get("target_language") or "English")
    if not doc_id_str:
        raise ValueError("payload.document_id is required")
    repo = DocumentRepository(db)
    doc = await repo.get_for_workspace(ctx.workspace_id, uuid.UUID(doc_id_str))
    if doc is None:
        raise ValueError("document not found")
    doc.content_md = await translate_markdown(
        doc.content_md or "", target_language=target
    )
    await repo.save(doc)
    return {"document_id": doc_id_str, "target_language": target}


def register_default_handlers() -> None:
    """Importing this module already registers the handlers via decorators;
    this function exists so callers (e.g. tests) can re-run setup explicitly."""
    return


async def shutdown() -> None:
    """Cancel the worker task — called from app shutdown."""
    global _worker_task
    if _worker_task is not None:
        _worker_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _worker_task
        _worker_task = None
