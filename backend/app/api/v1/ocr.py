import uuid

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_workspace_id
from app.core.database import get_db
from app.models.document import Document
from app.repositories.documents import DocumentRepository
from app.schemas.documents import DocumentRead
from app.services.ocr import get_provider

router = APIRouter()


class OCRRequest(BaseModel):
    image_base64: str = Field(min_length=4, max_length=20_000_000)
    hint: str | None = Field(default=None, max_length=1_000)


class OCRResponse(BaseModel):
    text: str
    provider: str
    model: str


@router.post("", response_model=OCRResponse)
async def transcribe(payload: OCRRequest) -> OCRResponse:
    result = await get_provider().transcribe(image_b64=payload.image_base64, hint=payload.hint)
    return OCRResponse(text=result.text, provider=result.provider, model=result.model)


class OCRToDocRequest(OCRRequest):
    title: str = Field(min_length=1, max_length=512)


@router.post(
    "/to-document",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def transcribe_into_document(
    payload: OCRToDocRequest,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Transcribe an image and persist the text as a new document."""
    result = await get_provider().transcribe(image_b64=payload.image_base64, hint=payload.hint)
    doc = Document(
        workspace_id=workspace_id,
        title=payload.title,
        content_md=result.text,
    )
    return await DocumentRepository(db).create(doc)
