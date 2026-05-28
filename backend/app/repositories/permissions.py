import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.permission import DocumentPermission, SharingLink
from app.repositories.base_repo import BaseRepository


class PermissionRepository(BaseRepository[DocumentPermission]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, DocumentPermission)

    async def list_for_document(self, document_id: uuid.UUID) -> list[DocumentPermission]:
        stmt = (
            select(DocumentPermission)
            .where(DocumentPermission.document_id == document_id)
            .order_by(DocumentPermission.created_at)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def find(
        self,
        document_id: uuid.UUID,
        principal_type: str,
        principal_id: str,
    ) -> DocumentPermission | None:
        stmt = select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.principal_type == principal_type,
            DocumentPermission.principal_id == principal_id,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()


class SharingLinkRepository(BaseRepository[SharingLink]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, SharingLink)

    async def list_for_document(self, document_id: uuid.UUID) -> list[SharingLink]:
        stmt = (
            select(SharingLink)
            .where(SharingLink.document_id == document_id)
            .order_by(SharingLink.created_at.desc())
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def get_by_token(self, token: str) -> SharingLink | None:
        stmt = select(SharingLink).where(SharingLink.token == token)
        return (await self.db.execute(stmt)).scalar_one_or_none()
