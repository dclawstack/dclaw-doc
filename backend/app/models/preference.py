import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class AIFeedback(Base):
    """Captured (ai_suggestion, accepted_text) pair → preference dataset.

    Submitted by the frontend after the user accepts, rejects, or edits
    an AI suggestion. Aggregated later (potentially in a background job)
    into a JSONL preference file for fine-tuning a ranking model.
    """

    __tablename__ = "ai_feedback"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    mode: Mapped[str] = mapped_column(String(32))  # rewrite, summarize, etc.
    prompt: Mapped[str] = mapped_column(Text)
    suggestion: Mapped[str] = mapped_column(Text)
    accepted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    action: Mapped[str] = mapped_column(String(16))  # accepted | edited | rejected
    user_id: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
