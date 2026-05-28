import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.template import Template
from app.repositories.base_repo import BaseRepository


class TemplateRepository(BaseRepository[Template]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Template)

    async def list_for_workspace(self, workspace_id: uuid.UUID) -> list[Template]:
        stmt = (
            select(Template)
            .where(Template.workspace_id == workspace_id)
            .order_by(Template.name)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def get_for_workspace(
        self, workspace_id: uuid.UUID, template_id: uuid.UUID
    ) -> Template | None:
        stmt = select(Template).where(
            Template.id == template_id,
            Template.workspace_id == workspace_id,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()
