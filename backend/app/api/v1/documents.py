import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import authorized_doc, current_workspace_id
from app.core.auth import CurrentUser, current_user
from app.core.config import is_enabled
from app.core.database import get_db
from app.models.document import Document
from app.repositories.document_versions import DocumentVersionRepository
from app.repositories.documents import DocumentRepository
from app.services.acl import effective_role
from app.schemas.document_versions import (
    DocumentVersionRead,
    DocumentVersionSummary,
)
from app.schemas.documents import (
    DocumentCreate,
    DocumentListResponse,
    DocumentRead,
    DocumentUpdate,
)
from app.services.rag import reindex_document
from app.services.versioning import has_content_changed, snapshot

router = APIRouter()


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
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
        created_by=user.user_id,
    )
    created = await repo.create(doc)
    if is_enabled("rag") and created.content_md:
        await reindex_document(db, created)
    return created


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    q: str | None = Query(default=None, description="Title search"),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentListResponse:
    repo = DocumentRepository(db)
    items, total = await repo.list_for_workspace(
        workspace_id, q=q, limit=limit, offset=offset
    )
    # Filter down to docs the user can view. The ACL service falls back
    # to ``editor`` when no explicit permissions exist, so any doc with
    # no ACL rows passes through; restricted docs are excluded.
    visible: list = []
    for doc in items:
        role = await effective_role(db, document=doc, user_id=user.user_id)
        if role is not None:
            visible.append(doc)
    return DocumentListResponse(
        items=[DocumentRead.model_validate(i) for i in visible],
        total=len(visible) if total == len(items) else total,
        limit=limit,
        offset=offset,
    )


@router.get("/{doc_id}", response_model=DocumentRead)
async def get_document(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Document:
    return await authorized_doc("viewer", doc_id, workspace_id, user, db)


@router.patch("/{doc_id}", response_model=DocumentRead)
async def update_document(
    doc_id: uuid.UUID,
    payload: DocumentUpdate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Document:
    doc = await authorized_doc("editor", doc_id, workspace_id, user, db)
    repo = DocumentRepository(db)

    patch = payload.model_dump(exclude_unset=True)
    if is_enabled("versions") and has_content_changed(doc, patch):
        version_repo = DocumentVersionRepository(db)
        await snapshot(version_repo, document=doc, author_id=user.user_id)

    content_changed = has_content_changed(doc, patch)
    for field, value in patch.items():
        setattr(doc, field, value)
    saved = await repo.save(doc)
    if is_enabled("rag") and content_changed:
        await reindex_document(db, saved)
    return saved


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    doc = await authorized_doc("owner", doc_id, workspace_id, user, db)
    await DocumentRepository(db).soft_delete(doc)


# --- Versions (1.4) ---

async def _require_doc(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID,
    db: AsyncSession,
) -> Document:
    repo = DocumentRepository(db)
    doc = await repo.get_for_workspace(workspace_id, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.get("/{doc_id}/versions", response_model=list[DocumentVersionSummary])
async def list_versions(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    if not is_enabled("versions"):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="versions disabled")
    await _require_doc(doc_id, workspace_id, db)
    return await DocumentVersionRepository(db).list_for_document(doc_id)


@router.get("/{doc_id}/versions/{version_num}", response_model=DocumentVersionRead)
async def get_version(
    doc_id: uuid.UUID,
    version_num: int,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    if not is_enabled("versions"):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="versions disabled")
    await _require_doc(doc_id, workspace_id, db)
    version = await DocumentVersionRepository(db).get(doc_id, version_num)
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return version


@router.post("/{doc_id}/versions/{version_num}/restore", response_model=DocumentRead)
async def restore_version(
    doc_id: uuid.UUID,
    version_num: int,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Restore the document to the contents of a prior version.

    Snapshots the *current* state first so the restore itself is reversible.
    """
    if not is_enabled("versions"):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="versions disabled")
    doc = await _require_doc(doc_id, workspace_id, db)
    version_repo = DocumentVersionRepository(db)
    target = await version_repo.get(doc_id, version_num)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    await snapshot(version_repo, document=doc, author_id=user.user_id)
    doc.title = target.title
    doc.content_md = target.content_md
    doc.content_json = target.content_json
    return await DocumentRepository(db).save(doc)
