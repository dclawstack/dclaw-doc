from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workspace import Workspace
from app.repositories.base_repo import BaseRepository


class WorkspaceRepository(BaseRepository[Workspace]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Workspace)

    async def get_by_slug(self, slug: str) -> Workspace | None:
        result = await self.db.execute(select(Workspace).where(Workspace.slug == slug))
        return result.scalar_one_or_none()
