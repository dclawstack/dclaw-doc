import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import authorized_doc, current_workspace_id
from app.core.auth import CurrentUser, current_user
from app.core.database import get_db
from app.repositories.documents import DocumentRepository
from app.schemas.documents import DocumentRead
from app.services.translation import translate_markdown

router = APIRouter()


class TranslateRequest(BaseModel):
    target_language: str = Field(min_length=2, max_length=64)
    glossary: dict[str, str] = Field(default_factory=dict)
    in_place: bool = False  # if True, overwrite the document's content_md


@router.post("/documents/{doc_id}/translate", response_model=DocumentRead)
async def translate_document(
    doc_id: uuid.UUID,
    payload: TranslateRequest,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    required = "editor" if payload.in_place else "viewer"
    doc = await authorized_doc(required, doc_id, workspace_id, user, db)
    repo = DocumentRepository(db)

    translated = await translate_markdown(
        doc.content_md or "",
        target_language=payload.target_language,
        glossary=payload.glossary,
    )

    if payload.in_place:
        doc.content_md = translated
        return await repo.save(doc)

    # Return a synthesised DocumentRead without persisting.
    return DocumentRead(
        id=doc.id,
        workspace_id=doc.workspace_id,
        folder_id=doc.folder_id,
        title=f"{doc.title} ({payload.target_language})",
        content_md=translated,
        content_json=doc.content_json,
        status=doc.status,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )
