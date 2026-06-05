import hashlib
import hmac
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import authorized_doc, current_workspace_id
from app.core.auth import CurrentUser, current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.sign_request import SignRequest
from app.repositories.documents import DocumentRepository
from app.services.compliance import record_event
from app.services.esign import get_provider

router = APIRouter()


class SignRequestCreate(BaseModel):
    signer_email: EmailStr
    signer_name: str | None = Field(default=None, max_length=255)


class SignRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    provider: str
    external_id: str | None
    signer_email: str
    signer_name: str | None
    status: str
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: SignRequest) -> "SignRequestRead":
        return cls.model_validate(
            {
                "id": row.id,
                "document_id": row.document_id,
                "provider": row.provider,
                "external_id": row.external_id,
                "signer_email": row.signer_email,
                "signer_name": row.signer_name,
                "status": row.status,
                "created_at": row.created_at.isoformat() if row.created_at else "",
                "updated_at": row.updated_at.isoformat() if row.updated_at else "",
            }
        )


class WebhookEvent(BaseModel):
    external_id: str
    status: str = Field(pattern=r"^(sent|viewed|signed|declined|expired)$")


@router.post(
    "/documents/{doc_id}/sign-requests",
    response_model=SignRequestRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_sign_request(
    doc_id: uuid.UUID,
    payload: SignRequestCreate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await authorized_doc("owner", doc_id, workspace_id, user, db)

    provider = get_provider()
    sent = await provider.send(
        document_id=doc_id,
        signer_email=str(payload.signer_email),
        signer_name=payload.signer_name,
        document_md=doc.content_md or "",
    )
    sr = SignRequest(
        document_id=doc_id,
        workspace_id=workspace_id,
        provider=provider.name,
        external_id=sent.external_id,
        signer_email=str(payload.signer_email),
        signer_name=payload.signer_name,
        status=sent.status,
    )
    db.add(sr)
    await db.commit()
    await db.refresh(sr)

    await record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.user_id,
        action="sign_request.sent",
        document_id=doc_id,
        payload={"sign_request_id": str(sr.id), "signer_email": str(payload.signer_email)},
    )
    return SignRequestRead.from_row(sr)


@router.get(
    "/documents/{doc_id}/sign-requests",
    response_model=list[SignRequestRead],
)
async def list_sign_requests(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorized_doc("viewer", doc_id, workspace_id, user, db)
    stmt = (
        select(SignRequest)
        .where(
            SignRequest.workspace_id == workspace_id,
            SignRequest.document_id == doc_id,
        )
        .order_by(SignRequest.created_at.desc())
    )
    return [SignRequestRead.from_row(r) for r in (await db.execute(stmt)).scalars().all()]


@router.post("/sign-requests/webhook")
async def sign_request_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Provider-agnostic webhook entrypoint.

    Webhooks can spoof sign-request status, so we verify an HMAC-SHA256
    signature over the raw request body (header ``X-Signature``) against the
    shared ``sign_webhook_secret`` before mutating any state. Fail-closed: if
    the secret is unset, the header is missing, or the signature doesn't
    match, we reject with 401.
    """
    secret = settings.sign_webhook_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook signature verification not configured",
        )

    raw_body = await request.body()
    provided_sig = request.headers.get("X-Signature")
    if not provided_sig:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing webhook signature",
        )

    expected_sig = hmac.new(
        secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected_sig, provided_sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    try:
        event = WebhookEvent.model_validate_json(raw_body)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        ) from exc

    stmt = select(SignRequest).where(SignRequest.external_id == event.external_id)
    sr = (await db.execute(stmt)).scalar_one_or_none()
    if sr is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No sign_request matches that external_id",
        )
    sr.status = event.status
    await db.commit()
    await db.refresh(sr)

    await record_event(
        db,
        workspace_id=sr.workspace_id,
        actor_id="webhook",
        action=f"sign_request.{event.status}",
        document_id=sr.document_id,
        payload={"sign_request_id": str(sr.id), "external_id": event.external_id},
    )
    return {"ok": True, "status": sr.status}
