import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.repositories.base_repo import BaseRepository


class CommentRepository(BaseRepository[Comment]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Comment)

    async def list_for_document(self, document_id: uuid.UUID) -> list[Comment]:
        stmt = (
            select(Comment)
            .where(Comment.document_id == document_id)
            .order_by(Comment.created_at)
        )
        return list((await self.db.execute(stmt)).scalars().all())
