import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10_000)
    parent_id: uuid.UUID | None = None
    anchor_block_id: str | None = Field(default=None, max_length=64)


class CommentUpdate(BaseModel):
    body: str | None = Field(default=None, min_length=1, max_length=10_000)
    resolved: bool | None = None


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    parent_id: uuid.UUID | None
    anchor_block_id: str | None
    body: str
    author_id: str
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime
