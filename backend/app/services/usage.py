"""Per-workspace usage telemetry.

Idempotent UPSERT on (workspace_id, date, provider, model). Uses an
in-place UPDATE-or-INSERT loop so we don't depend on dialect-specific
ON CONFLICT for the SQLite local-dev path.
"""
from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utc_now
from app.models.usage import WorkspaceUsage


async def record_usage(
    db: AsyncSession,
    *,
    workspace_id: uuid.UUID,
    provider: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> None:
    today: date = utc_now().date()
    stmt = select(WorkspaceUsage).where(
        WorkspaceUsage.workspace_id == workspace_id,
        WorkspaceUsage.date == today,
        WorkspaceUsage.provider == provider,
        WorkspaceUsage.model == model,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is None:
        existing = WorkspaceUsage(
            workspace_id=workspace_id,
            date=today,
            provider=provider,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            requests=1,
        )
        db.add(existing)
    else:
        existing.prompt_tokens += prompt_tokens
        existing.completion_tokens += completion_tokens
        existing.requests += 1
    await db.commit()
