import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_workspace_id
from app.core.database import get_db
from app.models.folder import Folder
from app.repositories.folders import FolderRepository
from app.schemas.folders import FolderCreate, FolderRead

router = APIRouter()


@router.post("", response_model=FolderRead, status_code=status.HTTP_201_CREATED)
async def create_folder(
    payload: FolderCreate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> Folder:
    repo = FolderRepository(db)
    folder = Folder(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        parent_id=payload.parent_id,
        name=payload.name,
    )
    return await repo.create(folder)


@router.get("", response_model=list[FolderRead])
async def list_folders(
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> list[Folder]:
    repo = FolderRepository(db)
    return await repo.list_for_workspace(workspace_id)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    repo = FolderRepository(db)
    folder = await repo.get_by_id(folder_id)
    if folder is None or folder.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    await repo.delete(folder)
