import uuid
from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.utils import utc_now
from app.models.base import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(default=utc_now)

    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        back_populates="workspace",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    folders: Mapped[list["Folder"]] = relationship(  # noqa: F821
        back_populates="workspace",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
