import json
import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import PlainTextResponse

from app.api.deps import current_workspace_id
from app.core.auth import CurrentUser, current_user
from app.core.database import get_db
from app.models.preference import AIFeedback

router = APIRouter()


class FeedbackCreate(BaseModel):
    document_id: uuid.UUID | None = None
    mode: str = Field(min_length=1, max_length=32)
    prompt: str
    suggestion: str
    accepted_text: str | None = None
    action: str = Field(pattern=r"^(accepted|edited|rejected)$")


class FeedbackRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    document_id: uuid.UUID | None
    mode: str
    prompt: str
    suggestion: str
    accepted_text: str | None
    action: str
    user_id: str
    created_at: str


@router.post("", status_code=201)
async def submit_feedback(
    payload: FeedbackCreate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    row = AIFeedback(
        workspace_id=workspace_id,
        document_id=payload.document_id,
        mode=payload.mode,
        prompt=payload.prompt,
        suggestion=payload.suggestion,
        accepted_text=payload.accepted_text,
        action=payload.action,
        user_id=user.user_id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"id": str(row.id)}


@router.get("/export.jsonl", response_class=PlainTextResponse)
async def export_jsonl(
    since: str | None = Query(default=None),  # ISO date prefix filter
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> PlainTextResponse:
    """Export accepted/edited pairs as JSONL suitable for SFT or DPO."""
    stmt = (
        select(AIFeedback)
        .where(AIFeedback.workspace_id == workspace_id)
        .where(AIFeedback.action.in_(["accepted", "edited"]))
        .order_by(AIFeedback.created_at)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    if since:
        rows = [
            r for r in rows if r.created_at and r.created_at.isoformat() >= since
        ]
    lines: list[str] = []
    for r in rows:
        lines.append(
            json.dumps(
                {
                    "prompt": r.prompt,
                    "suggestion": r.suggestion,
                    "accepted": r.accepted_text or r.suggestion,
                    "mode": r.mode,
                    "action": r.action,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
            )
        )
    return PlainTextResponse("\n".join(lines), media_type="application/x-ndjson")
