import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class DocumentVersion(Base):
    """Immutable snapshot of a document at a point in time.

    A new row is created whenever ``title``, ``content_md`` or
    ``content_json`` changes via PATCH. ``version_num`` is a monotonically
    increasing per-document counter starting at 1.
    """

    __tablename__ = "document_versions"
    __table_args__ = (
        UniqueConstraint("document_id", "version_num", name="uq_document_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        index=True,
    )
    version_num: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(512))
    content_md: Mapped[str] = mapped_column(Text)
    content_json: Mapped[str] = mapped_column(Text)
    author_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
