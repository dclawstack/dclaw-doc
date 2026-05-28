import uuid

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_version import DocumentVersion
from app.repositories.base_repo import BaseRepository


class DocumentVersionRepository(BaseRepository[DocumentVersion]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, DocumentVersion)

    async def next_version_num(self, document_id: uuid.UUID) -> int:
        stmt = select(func.max(DocumentVersion.version_num)).where(
            DocumentVersion.document_id == document_id
        )
        current = (await self.db.execute(stmt)).scalar() or 0
        return int(current) + 1

    async def list_for_document(self, document_id: uuid.UUID) -> list[DocumentVersion]:
        stmt = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document_id)
            .order_by(desc(DocumentVersion.version_num))
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def get(self, document_id: uuid.UUID, version_num: int) -> DocumentVersion | None:
        stmt = select(DocumentVersion).where(
            DocumentVersion.document_id == document_id,
            DocumentVersion.version_num == version_num,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()
