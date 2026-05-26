import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.folder import Folder
from app.repositories.base_repo import BaseRepository


class FolderRepository(BaseRepository[Folder]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Folder)

    async def list_for_workspace(self, workspace_id: uuid.UUID) -> list[Folder]:
        stmt = (
            select(Folder)
            .where(Folder.workspace_id == workspace_id)
            .order_by(Folder.name)
        )
        return list((await self.db.execute(stmt)).scalars().all())
