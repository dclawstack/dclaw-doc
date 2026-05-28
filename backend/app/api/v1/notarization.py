import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_workspace_id
from app.core.auth import CurrentUser, current_user
from app.core.database import get_db
from app.models.notarization import Notarization
from app.repositories.document_versions import DocumentVersionRepository
from app.repositories.documents import DocumentRepository
from app.services.compliance import record_event
from app.services.notarization import content_hash, sign, verify

router = APIRouter()


class NotarizeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    version_num: int
    content_hash: str
    signature: str
    notarized_by: str
    created_at: str

    @classmethod
    def from_row(cls, row: Notarization) -> "NotarizeResponse":
        return cls.model_validate(
            {
                "id": row.id,
                "document_id": row.document_id,
                "version_num": row.version_num,
                "content_hash": row.content_hash,
                "signature": row.signature,
                "notarized_by": row.notarized_by,
                "created_at": row.created_at.isoformat() if row.created_at else "",
            }
        )


class VerifyResponse(BaseModel):
    valid: bool
    notarization_id: uuid.UUID
    expected_signature: str
    current_content_hash: str


@router.post(
    "/documents/{doc_id}/notarize",
    response_model=NotarizeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def notarize(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = DocumentRepository(db)
    doc = await repo.get_for_workspace(workspace_id, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    next_version = await DocumentVersionRepository(db).next_version_num(doc_id)
    digest = content_hash(doc, next_version)
    signature = sign(digest)

    record = Notarization(
        document_id=doc_id,
        version_num=next_version,
        content_hash=digest,
        signature=signature,
        notarized_by=user.user_id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    await record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.user_id,
        action="document.notarize",
        document_id=doc_id,
        payload={"version_num": next_version, "content_hash": digest},
    )
    return NotarizeResponse.from_row(record)


@router.get("/documents/{doc_id}/notarization", response_model=VerifyResponse)
async def verify_notarization(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    doc = await DocumentRepository(db).get_for_workspace(workspace_id, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    stmt = (
        select(Notarization)
        .where(Notarization.document_id == doc_id)
        .order_by(desc(Notarization.created_at))
        .limit(1)
    )
    latest = (await db.execute(stmt)).scalar_one_or_none()
    if latest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No notarization on file for this document",
        )

    current_hash = content_hash(doc, latest.version_num)
    valid = current_hash == latest.content_hash and verify(latest.content_hash, latest.signature)
    return VerifyResponse(
        valid=valid,
        notarization_id=latest.id,
        expected_signature=latest.signature,
        current_content_hash=current_hash,
    )
