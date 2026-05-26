import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_workspace_id
from app.core.database import get_db
from app.models.document import Document
from app.repositories.documents import DocumentRepository
from app.schemas.documents import (
    DocumentCreate,
    DocumentListResponse,
    DocumentRead,
    DocumentUpdate,
)

router = APIRouter()


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> Document:
    repo = DocumentRepository(db)
    doc = Document(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        folder_id=payload.folder_id,
        title=payload.title,
        content_md=payload.content_md,
        content_json=payload.content_json,
        status=payload.status,
    )
    return await repo.create(doc)


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    q: str | None = Query(default=None, description="Title search"),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> DocumentListResponse:
    repo = DocumentRepository(db)
    items, total = await repo.list_for_workspace(
        workspace_id, q=q, limit=limit, offset=offset
    )
    return DocumentListResponse(
        items=[DocumentRead.model_validate(i) for i in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{doc_id}", response_model=DocumentRead)
async def get_document(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> Document:
    repo = DocumentRepository(db)
    doc = await repo.get_for_workspace(workspace_id, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.patch("/{doc_id}", response_model=DocumentRead)
async def update_document(
    doc_id: uuid.UUID,
    payload: DocumentUpdate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> Document:
    repo = DocumentRepository(db)
    doc = await repo.get_for_workspace(workspace_id, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)
    return await repo.save(doc)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    repo = DocumentRepository(db)
    doc = await repo.get_for_workspace(workspace_id, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    await repo.soft_delete(doc)
