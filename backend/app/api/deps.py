import uuid

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, current_user
from app.core.database import get_db
from app.repositories.workspaces import WorkspaceRepository

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
