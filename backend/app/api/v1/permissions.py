import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_workspace_id
from app.core.config import is_enabled
from app.core.database import get_db
from app.core.utils import utc_now
from app.models.permission import DocumentPermission, SharingLink
from app.repositories.documents import DocumentRepository
from app.repositories.permissions import PermissionRepository, SharingLinkRepository
from app.schemas.permissions import (
    PermissionGrant,
    PermissionRead,
    SharingLinkCreate,
    SharingLinkRead,
)

router = APIRouter()


def _require_enabled() -> None:
    if not is_enabled("permissions"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="permissions feature is disabled",
        )


async def _require_doc(doc_id: uuid.UUID, workspace_id: uuid.UUID, db: AsyncSession):
    doc = await DocumentRepository(db).get_for_workspace(workspace_id, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.get("/documents/{doc_id}/permissions", response_model=list[PermissionRead])
async def list_permissions(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    await _require_doc(doc_id, workspace_id, db)
    return await PermissionRepository(db).list_for_document(doc_id)


@router.post(
    "/documents/{doc_id}/permissions",
    response_model=PermissionRead,
    status_code=status.HTTP_201_CREATED,
)
async def grant_permission(
    doc_id: uuid.UUID,
    payload: PermissionGrant,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    await _require_doc(doc_id, workspace_id, db)
    repo = PermissionRepository(db)

    existing = await repo.find(doc_id, payload.principal_type, payload.principal_id)
    if existing is not None:
        existing.role = payload.role
        await db.commit()
        await db.refresh(existing)
        return existing

    perm = DocumentPermission(
        document_id=doc_id,
        principal_type=payload.principal_type,
        principal_id=payload.principal_id,
        role=payload.role,
    )
    try:
        return await repo.create(perm)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="duplicate") from exc


@router.delete(
    "/documents/{doc_id}/permissions/{permission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_permission(
    doc_id: uuid.UUID,
    permission_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    await _require_doc(doc_id, workspace_id, db)
    repo = PermissionRepository(db)
    perm = await repo.get_by_id(permission_id)
    if perm is None or perm.document_id != doc_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    await repo.delete(perm)


# --- Sharing links ---

@router.post(
    "/documents/{doc_id}/sharing-links",
    response_model=SharingLinkRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_sharing_link(
    doc_id: uuid.UUID,
    payload: SharingLinkCreate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    await _require_doc(doc_id, workspace_id, db)
    expires_at = payload.expires_at
    if expires_at is not None and expires_at.tzinfo is not None:
        expires_at = expires_at.replace(tzinfo=None)
    link = SharingLink(
        document_id=doc_id,
        token=secrets.token_urlsafe(24),
        role=payload.role,
        expires_at=expires_at,
    )
    return await SharingLinkRepository(db).create(link)


@router.get("/documents/{doc_id}/sharing-links", response_model=list[SharingLinkRead])
async def list_sharing_links(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    await _require_doc(doc_id, workspace_id, db)
    return await SharingLinkRepository(db).list_for_document(doc_id)


@router.delete(
    "/sharing-links/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_sharing_link(
    link_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    repo = SharingLinkRepository(db)
    link = await repo.get_by_id(link_id)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    # Ensure the link's doc is in this workspace
    await _require_doc(link.document_id, workspace_id, db)
    link.revoked_at = utc_now()
    await db.commit()
