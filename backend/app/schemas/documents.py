import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    content_md: str = ""
    content_json: str = "{}"
    folder_id: uuid.UUID | None = None
    status: str = "draft"


class DocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    content_md: str | None = None
    content_json: str | None = None
    folder_id: uuid.UUID | None = None
    status: str | None = None


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    folder_id: uuid.UUID | None
    title: str
    content_md: str
    content_json: str
    status: str
    sensitivity: str = "public"
    created_at: datetime
    updated_at: datetime


class DocumentListResponse(BaseModel):
    items: list[DocumentRead]
    total: int
    limit: int
    offset: int
