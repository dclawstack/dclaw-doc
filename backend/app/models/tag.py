import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("workspace_id", "name", name="uq_tag_workspace_name"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class DocumentTag(Base):
    __tablename__ = "document_tags"
    __table_args__ = (UniqueConstraint("document_id", "tag_id", name="uq_document_tag"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        index=True,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"),
        index=True,
    )
