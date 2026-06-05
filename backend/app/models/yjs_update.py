import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class YjsUpdate(Base):
    """Append-only Yjs update log per document (2.1).

    Each row is one opaque y-protocol update frame received over the
    WebSocket. The server never interprets the bytes — clients hydrate
    a Y.Doc by replaying the log, then receive live updates from peers.
    ``seq`` orders the appends within a document.
    """

    __tablename__ = "yjs_updates"
    __table_args__ = (
        UniqueConstraint("document_id", "seq", name="uq_yjs_update_doc_seq"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        index=True,
    )
    seq: Mapped[int] = mapped_column(Integer)
    payload: Mapped[bytes] = mapped_column(LargeBinary)
    author_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
