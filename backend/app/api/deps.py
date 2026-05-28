import uuid

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, current_user
from app.core.database import get_db
from app.models.document import Document
from app.repositories.documents import DocumentRepository
from app.repositories.workspaces import WorkspaceRepository
from app.services.acl import has_role

DEFAULT_WORKSPACE_SLUG = "personal"
_SENTINEL_UUID = uuid.UUID(int=0)


async def current_workspace_id(
    user: CurrentUser = Depends(current_user),
    x_workspace_id: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    """Resolve the active workspace for the request.

    Resolution order:
      1. ``workspace_id`` claim on the verified JWT (production path).
      2. ``X-Workspace-Id`` request header (useful for dev / tools).
      3. The seeded ``personal`` workspace (anonymous dev fallback).
    """
    if user.workspace_id != _SENTINEL_UUID:
        return user.workspace_id

    if x_workspace_id:
        try:
            return uuid.UUID(x_workspace_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="X-Workspace-Id must be a valid UUID",
            ) from exc

    repo = WorkspaceRepository(db)
    default = await repo.get_by_slug(DEFAULT_WORKSPACE_SLUG)
    if default is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Default workspace not yet provisioned",
        )
    return default.id


async def authorized_doc(
    required_role: str,
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession,
) -> Document:
    """Fetch + ACL-check a document.

    Raises 404 when the document isn't in the workspace, 403 when the
    user lacks the required role on it.
    """
    doc = await DocumentRepository(db).get_for_workspace(workspace_id, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if not await has_role(db, document=doc, user_id=user.user_id, required=required_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"requires role >= {required_role}",
        )
    return doc
