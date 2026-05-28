import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_workspace_id
from app.core.auth import CurrentUser, current_user
from app.core.database import get_db
from app.models.audit_event import AuditEvent
from app.repositories.documents import DocumentRepository
from app.services.compliance import detect_pii, record_event, redact

router = APIRouter()


class PIIScanRequest(BaseModel):
    text: str = Field(min_length=1, max_length=200_000)


class PIIScanResponse(BaseModel):
    findings: list[dict]


class PIIRedactResponse(BaseModel):
    redacted: str
    findings: list[dict]


class SensitivityUpdate(BaseModel):
    sensitivity: str = Field(pattern=r"^(public|confidential|pii|phi)$")


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    document_id: uuid.UUID | None
    actor_id: str
    action: str
    payload: str
    created_at: str

    @classmethod
    def model_validate(cls, obj, **kwargs):  # type: ignore[override]
        # ISO-format datetime for JSON friendliness
        data = {
            "id": obj.id,
            "workspace_id": obj.workspace_id,
            "document_id": obj.document_id,
            "actor_id": obj.actor_id,
            "action": obj.action,
            "payload": obj.payload,
            "created_at": obj.created_at.isoformat() if obj.created_at else "",
        }
        return super().model_validate(data, **kwargs)


@router.post("/compliance/scan", response_model=PIIScanResponse)
async def scan_pii(payload: PIIScanRequest) -> PIIScanResponse:
    return PIIScanResponse(findings=detect_pii(payload.text))


@router.post("/compliance/redact", response_model=PIIRedactResponse)
async def redact_pii(payload: PIIScanRequest) -> PIIRedactResponse:
    redacted, findings = redact(payload.text)
    return PIIRedactResponse(redacted=redacted, findings=findings)


@router.patch("/documents/{doc_id}/sensitivity")
async def set_sensitivity(
    doc_id: uuid.UUID,
    payload: SensitivityUpdate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = DocumentRepository(db)
    doc = await repo.get_for_workspace(workspace_id, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    previous = doc.sensitivity
    doc.sensitivity = payload.sensitivity
    await repo.save(doc)

    await record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.user_id,
        action="sensitivity.change",
        document_id=doc_id,
        payload={"from": previous, "to": payload.sensitivity},
    )
    return {"sensitivity": doc.sensitivity}


@router.get("/audit", response_model=list[AuditEventRead])
async def list_audit_events(
    document_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AuditEvent)
        .where(AuditEvent.workspace_id == workspace_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
    )
    if document_id is not None:
        stmt = stmt.where(AuditEvent.document_id == document_id)
    rows = list((await db.execute(stmt)).scalars().all())
    return [AuditEventRead.model_validate(r) for r in rows]
