import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.workspace import Workspace
from app.repositories.workspaces import WorkspaceRepository
from app.schemas.workspaces import WorkspaceCreate, WorkspaceRead

router = APIRouter()


@router.post("", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
) -> Workspace:
    repo = WorkspaceRepository(db)
    workspace = Workspace(id=uuid.uuid4(), slug=payload.slug, name=payload.name)
    try:
        return await repo.create(workspace)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Workspace slug '{payload.slug}' already exists",
        ) from exc


@router.get("", response_model=list[WorkspaceRead])
async def list_workspaces(db: AsyncSession = Depends(get_db)) -> list[Workspace]:
    repo = WorkspaceRepository(db)
    items, _ = await repo.list_all(limit=100, offset=0)
    return items


@router.get("/{workspace_id}", response_model=WorkspaceRead)
async def get_workspace(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Workspace:
    repo = WorkspaceRepository(db)
    workspace = await repo.get_by_id(workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return workspace
