import uuid
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class CreateDocRequest(BaseModel):
    title: str
    content: str


class DocResponse(BaseModel):
    id: str
    title: str
    content: str
    version: int
    collaborators: list[str]
    suggestions: list[str]
    created_at: str


class VersionResponse(BaseModel):
    version: int
    created_at: str


@router.post("/docs")
async def create_doc(req: CreateDocRequest):
    return DocResponse(
        id=str(uuid.uuid4()),
        title=req.title,
        content=req.content,
        version=1,
        collaborators=[],
        suggestions=["Suggestion 1", "Suggestion 2"],
        created_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/docs/{id}/versions")
async def get_doc_versions(id: str):
    return [
        VersionResponse(
            version=1,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    ]
