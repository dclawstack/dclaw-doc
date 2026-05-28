import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class Template(Base):
    """A reusable document template.

    ``variables_schema`` is a JSON list of ``{name, label, default?}``
    objects. ``content_md`` may reference variables using ``{{name}}``
    placeholders; the render endpoint substitutes them and creates a
    document.
    """

    __tablename__ = "templates"
    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="uq_template_workspace_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_md: Mapped[str] = mapped_column(Text, default="")
    variables_schema: Mapped[str] = mapped_column(Text, default="[]")  # JSON
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)
