import uuid

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.workspaces import WorkspaceRepository

DEFAULT_WORKSPACE_SLUG = "personal"


async def current_workspace_id(
    x_workspace_id: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    """Resolve the active workspace for the request.

    Tier 0: accept an explicit `X-Workspace-Id` header, or fall back to the
    seeded `personal` workspace. Tier 1 will replace this with a Logto JWT
    claim.
    """
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
