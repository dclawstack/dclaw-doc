import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    version_num: int
    title: str
    content_md: str
    content_json: str
    author_id: str | None
    created_at: datetime


class DocumentVersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    version_num: int
    title: str
    author_id: str | None
    created_at: datetime
