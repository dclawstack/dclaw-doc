import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class WorkspaceUsage(Base):
    """Per-workspace daily aggregate of AI usage.

    Captured during streaming completions; one row per (workspace, date,
    provider, model). Tier-2 can roll this up into billing.
    """

    __tablename__ = "workspace_usage"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id", "date", "provider", "model", name="uq_usage_dimension"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
    )
    date: Mapped[date] = mapped_column(Date, index=True)
    provider: Mapped[str] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(128))
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    requests: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)
