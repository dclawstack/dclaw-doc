import uuid
from typing import Literal

from pydantic import BaseModel, Field


CopilotMode = Literal["rewrite", "summarize", "translate", "explain", "chat"]


class DocChatRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8_000)
    document_id: uuid.UUID | None = None
    selection: str | None = Field(default=None, max_length=20_000)
    mode: CopilotMode = "chat"
