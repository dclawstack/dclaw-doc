import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class LiveEmbed(Base):
    """Auto-refreshing data embed scoped to a workspace.

    ``kind`` is ``json_url`` or ``sql_view``. ``source`` is the URL or
    SQL text. ``payload`` is the last fetched body; ``etag`` is opaque
    and provider-defined; ``refreshed_at`` drives the dashboard "last
    updated N s ago" indicator.
    """

    __tablename__ = "live_embeds"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(128))
    kind: Mapped[str] = mapped_column(String(32))
    source: Mapped[str] = mapped_column(Text)
    payload: Mapped[str] = mapped_column(Text, default="")
    etag: Mapped[str | None] = mapped_column(String(128), nullable=True)
    refreshed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
