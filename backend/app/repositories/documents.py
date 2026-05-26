import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utc_now
from app.models.document import Document
from app.repositories.base_repo import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Document)

    def _scope(self, workspace_id: uuid.UUID, include_deleted: bool = False):
        stmt = select(Document).where(Document.workspace_id == workspace_id)
        if not include_deleted:
            stmt = stmt.where(Document.deleted_at.is_(None))
        return stmt

    async def list_for_workspace(
        self,
        workspace_id: uuid.UUID,
        *,
        q: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Document], int]:
        base_stmt = self._scope(workspace_id)
        if q:
            base_stmt = base_stmt.where(Document.title.ilike(f"%{q}%"))

        items_stmt = (
            base_stmt.order_by(Document.updated_at.desc()).limit(limit).offset(offset)
        )
        items = list((await self.db.execute(items_stmt)).scalars().all())

        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar() or 0
        return items, total

    async def get_for_workspace(
        self, workspace_id: uuid.UUID, doc_id: uuid.UUID
    ) -> Document | None:
        stmt = self._scope(workspace_id).where(Document.id == doc_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def soft_delete(self, doc: Document) -> Document:
        doc.deleted_at = utc_now()
        await self.db.commit()
        await self.db.refresh(doc)
        return doc

    async def save(self, doc: Document) -> Document:
        doc.updated_at = utc_now()
        await self.db.commit()
        await self.db.refresh(doc)
        return doc
