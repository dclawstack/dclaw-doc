import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import PlainTextResponse, Response

from app.api.deps import authorized_doc, current_workspace_id
from app.core.auth import CurrentUser, current_user
from app.core.config import is_enabled
from app.core.database import get_db
from app.models.document import Document
from app.repositories.documents import DocumentRepository
from app.schemas.documents import DocumentRead
from app.services.exporters import (
    export_html,
    export_json,
    export_markdown,
    parse_markdown_import,
)

router = APIRouter()


ExportFormat = Literal["md", "html", "json"]


class MarkdownImportRequest(BaseModel):
    content: str = Field(min_length=1, max_length=1_000_000)
    title: str | None = Field(default=None, max_length=512)
    folder_id: uuid.UUID | None = None


def _require_enabled() -> None:
    if not is_enabled("exports"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="exports feature is disabled",
        )


@router.get("/documents/{doc_id}/export")
async def export_document(
    doc_id: uuid.UUID,
    fmt: ExportFormat = Query(default="md"),
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    doc = await authorized_doc("viewer", doc_id, workspace_id, user, db)

    if fmt == "md":
        body = export_markdown(doc)
        return PlainTextResponse(body, media_type="text/markdown; charset=utf-8")
    if fmt == "html":
        return Response(export_html(doc), media_type="text/html; charset=utf-8")
    return Response(export_json(doc), media_type="application/json")


@router.post(
    "/imports/markdown",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def import_markdown(
    payload: MarkdownImportRequest,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> Document:
    _require_enabled()
    parsed_title, body = parse_markdown_import(payload.content)
    title = payload.title or parsed_title
    doc = Document(
        workspace_id=workspace_id,
        folder_id=payload.folder_id,
        title=title,
        content_md=body,
    )
    return await DocumentRepository(db).create(doc)
