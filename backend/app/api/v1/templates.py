import json
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_workspace_id
from app.core.config import is_enabled
from app.core.database import get_db
from app.models.document import Document
from app.models.template import Template
from app.repositories.documents import DocumentRepository
from app.repositories.templates import TemplateRepository
from app.schemas.documents import DocumentRead
from app.schemas.templates import (
    TemplateCreate,
    TemplateRead,
    TemplateRenderRequest,
)

router = APIRouter()


_PLACEHOLDER_RE = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")


def _require_enabled() -> None:
    if not is_enabled("templates"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="templates feature is disabled",
        )


def _render(content: str, variables: dict[str, str]) -> str:
    return _PLACEHOLDER_RE.sub(lambda m: variables.get(m.group(1), m.group(0)), content)


@router.post("", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    repo = TemplateRepository(db)
    template = Template(
        workspace_id=workspace_id,
        name=payload.name,
        description=payload.description,
        content_md=payload.content_md,
        variables_schema=json.dumps([v.model_dump() for v in payload.variables]),
    )
    try:
        return await repo.create(template)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Template '{payload.name}' already exists in this workspace",
        ) from exc


@router.get("", response_model=list[TemplateRead])
async def list_templates(
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    return await TemplateRepository(db).list_for_workspace(workspace_id)


@router.get("/{template_id}", response_model=TemplateRead)
async def get_template(
    template_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    template = await TemplateRepository(db).get_for_workspace(workspace_id, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    repo = TemplateRepository(db)
    template = await repo.get_for_workspace(workspace_id, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    await repo.delete(template)


@router.post(
    "/{template_id}/render",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def render_template(
    template_id: uuid.UUID,
    payload: TemplateRenderRequest,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a document from a template, substituting ``{{name}}`` placeholders."""
    _require_enabled()
    template = await TemplateRepository(db).get_for_workspace(workspace_id, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    # Merge defaults from the schema with caller-supplied values.
    try:
        schema = json.loads(template.variables_schema)
    except json.JSONDecodeError:
        schema = []
    merged: dict[str, str] = {}
    for entry in schema:
        if isinstance(entry, dict) and entry.get("name") and entry.get("default") is not None:
            merged[entry["name"]] = str(entry["default"])
    merged.update({k: str(v) for k, v in payload.variables.items()})

    rendered_md = _render(template.content_md, merged)
    document = Document(
        workspace_id=workspace_id,
        folder_id=payload.folder_id,
        title=payload.title or template.name,
        content_md=rendered_md,
    )
    return await DocumentRepository(db).create(document)
