import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: uuid.UUID | None = None


class FolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    created_at: datetime
