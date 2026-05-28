import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from app.api.deps import current_workspace_id
from app.core.config import is_enabled
from app.core.database import get_db
from app.schemas.ai import DocChatRequest
from app.services.doc_ai import stream_doc_chat

router = APIRouter()


@router.post("/doc-chat")
async def doc_chat(
    payload: DocChatRequest,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    if not is_enabled("ai_copilot"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ai_copilot feature is disabled",
        )

    generator = stream_doc_chat(
        db=db,
        workspace_id=workspace_id,
        document_id=payload.document_id,
        selection=payload.selection,
        prompt=payload.prompt,
        mode=payload.mode,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
