import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class Notarization(Base):
    """Cryptographic notarization of a specific document version.

    On approval, we hash the document body + title and HMAC-sign with the
    workspace key (settings.secret_key for now). ``content_hash`` lets a
    later verifier reproduce the digest from the current document state;
    ``signature`` is the HMAC that proves the workspace approved it.
    """

    __tablename__ = "notarizations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        index=True,
    )
    version_num: Mapped[int]
    content_hash: Mapped[str] = mapped_column(String(64))   # sha256 hex
    signature: Mapped[str] = mapped_column(String(64))      # hmac-sha256 hex
    notarized_by: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
