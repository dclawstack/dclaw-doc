import uuid
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from app.api.deps import current_workspace_id
from app.core.config import is_enabled
from app.core.database import get_db
from app.schemas.ai import (
    AgentRunRequest,
    DocChatRequest,
    SearchHitRead,
    SearchRequest,
    WorkspaceChatRequest,
)
from app.services.agent import AgentRunner
from app.services.doc_ai import stream_doc_chat
from app.services.rag import hybrid_search

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
        use_rag=payload.use_rag,
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


@router.post("/search", response_model=list[SearchHitRead])
async def search(
    payload: SearchRequest,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    if not is_enabled("rag"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="rag feature is disabled",
        )
    hits = await hybrid_search(
        db,
        workspace_id=workspace_id,
        query=payload.query,
        top_k=payload.top_k,
    )
    return [asdict(h) for h in hits]


@router.post("/chat")
async def workspace_chat(
    payload: WorkspaceChatRequest,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Workspace-wide RAG chat (2.3).

    Same SSE shape as ``/doc-chat`` but always grounded across the whole
    workspace — no ``document_id`` selection.
    """
    if not is_enabled("ai_copilot"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ai_copilot feature is disabled",
        )
    generator = stream_doc_chat(
        db=db,
        workspace_id=workspace_id,
        document_id=None,
        selection=None,
        prompt=payload.prompt,
        mode="chat",
        use_rag=True,
    )
    return StreamingResponse(generator, media_type="text/event-stream")


@router.post("/agent")
async def run_agent(
    payload: AgentRunRequest,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Agentic copilot — bounded tool-calling loop (2.2)."""
    if not is_enabled("ai_copilot"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ai_copilot feature is disabled",
        )
    runner = AgentRunner(max_steps=payload.max_steps)
    run = await runner.run(
        db=db,
        workspace_id=workspace_id,
        prompt=payload.prompt,
        context=payload.context,
    )
    return AgentRunner.as_dict(run)
