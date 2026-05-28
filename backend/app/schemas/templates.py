import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TemplateVariable(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    label: str | None = None
    default: str | None = None


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    content_md: str = ""
    variables: list[TemplateVariable] = Field(default_factory=list)


class TemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    description: str | None
    content_md: str
    variables_schema: str
    created_at: datetime
    updated_at: datetime


class TemplateRenderRequest(BaseModel):
    title: str | None = Field(default=None, max_length=512)
    variables: dict[str, str] = Field(default_factory=dict)
    folder_id: uuid.UUID | None = None
