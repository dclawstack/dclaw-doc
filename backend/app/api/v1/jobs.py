import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_workspace_id
from app.core.auth import CurrentUser, current_user
from app.core.database import get_db
from app.models.job import Job
from app.services.jobs import enqueue

router = APIRouter()


class JobEnqueueRequest(BaseModel):
    kind: str = Field(min_length=1, max_length=64)
    payload: dict = Field(default_factory=dict)


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    status: str
    payload: str
    result: str | None
    error: str | None
    started_at: str | None
    finished_at: str | None
    created_at: str

    @classmethod
    def from_row(cls, row: Job) -> "JobRead":
        return cls.model_validate(
            {
                "id": row.id,
                "kind": row.kind,
                "status": row.status,
                "payload": row.payload,
                "result": row.result,
                "error": row.error,
                "started_at": row.started_at.isoformat() if row.started_at else None,
                "finished_at": row.finished_at.isoformat() if row.finished_at else None,
                "created_at": row.created_at.isoformat() if row.created_at else "",
            }
        )


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def enqueue_job(
    payload: JobEnqueueRequest,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        job = await enqueue(
            db,
            workspace_id=workspace_id,
            kind=payload.kind,
            payload=payload.payload,
            enqueued_by=user.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return JobRead.from_row(job)


@router.get("/{job_id}", response_model=JobRead)
async def get_job(
    job_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(Job, job_id)
    if job is None or job.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JobRead.from_row(job)


@router.get("", response_model=list[JobRead])
async def list_jobs(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Job)
        .where(Job.workspace_id == workspace_id)
        .order_by(desc(Job.created_at))
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(Job.status == status_filter)
    rows = list((await db.execute(stmt)).scalars().all())
    return [JobRead.from_row(r) for r in rows]
