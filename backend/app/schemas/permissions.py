import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["viewer", "commenter", "editor", "owner"]


class PermissionGrant(BaseModel):
    principal_type: Literal["user", "link"]
    principal_id: str = Field(min_length=1, max_length=255)
    role: Role


class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    principal_type: str
    principal_id: str
    role: str
    created_at: datetime


class SharingLinkCreate(BaseModel):
    role: Role = "viewer"
    expires_at: datetime | None = None


class SharingLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    token: str
    role: str
    expires_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime
