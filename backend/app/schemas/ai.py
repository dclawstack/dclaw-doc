import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


CopilotMode = Literal["rewrite", "summarize", "translate", "explain", "chat"]


class DocChatRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8_000)
    document_id: uuid.UUID | None = None
    selection: str | None = Field(default=None, max_length=20_000)
    mode: CopilotMode = "chat"
    use_rag: bool = True


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2_000)
    top_k: int | None = Field(default=None, ge=1, le=50)


class SearchHitRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document_id: uuid.UUID
    chunk_id: uuid.UUID
    ordinal: int
    text: str
    score: float
    document_title: str
