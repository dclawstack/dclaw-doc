import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_workspace_id
from app.core.config import is_enabled
from app.core.database import get_db
from app.models.usage import WorkspaceUsage

router = APIRouter()


class UsageRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    workspace_id: uuid.UUID
    date: date
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    requests: int
    updated_at: datetime


@router.get("", response_model=list[UsageRow])
async def list_usage(
    since: date | None = Query(default=None),
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    if not is_enabled("usage"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="usage feature is disabled",
        )
    stmt = select(WorkspaceUsage).where(WorkspaceUsage.workspace_id == workspace_id)
    if since is not None:
        stmt = stmt.where(WorkspaceUsage.date >= since)
    stmt = stmt.order_by(WorkspaceUsage.date.desc(), WorkspaceUsage.model)
    return list((await db.execute(stmt)).scalars().all())
