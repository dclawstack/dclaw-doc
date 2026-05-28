import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_workspace_id
from app.core.database import get_db
from app.repositories.document_versions import DocumentVersionRepository
from app.repositories.documents import DocumentRepository
from app.services.merge import three_way_merge

router = APIRouter()


class MergeRequest(BaseModel):
    base_version_num: int = Field(ge=1, description="Version the client last synced from")
    local_content_md: str
    persist: bool = False


class MergeResponse(BaseModel):
    merged_content_md: str
    conflicts: int
    server_version_num: int
    persisted: bool


@router.post("/documents/{doc_id}/merge", response_model=MergeResponse)
async def merge_offline_edits(
    doc_id: uuid.UUID,
    payload: MergeRequest,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Reconcile divergent offline edits with the server's current state.

    The client sends the version number it forked from + its local
    content. The server fetches that snapshot, performs a 3-way merge
    against the current document body, and either returns the merged
    text (or text with conflict markers) or persists it directly when
    ``persist`` is true and no conflicts remain.
    """
    repo = DocumentRepository(db)
    doc = await repo.get_for_workspace(workspace_id, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    version_repo = DocumentVersionRepository(db)
    base_version = await version_repo.get(doc_id, payload.base_version_num)
    if base_version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Base version {payload.base_version_num} not found",
        )

    result = three_way_merge(
        base=base_version.content_md or "",
        server=doc.content_md or "",
        local=payload.local_content_md or "",
    )

    persisted = False
    server_version_num = await version_repo.next_version_num(doc_id) - 1
    if payload.persist and result.conflicts == 0:
        doc.content_md = result.text
        await repo.save(doc)
        server_version_num = await version_repo.next_version_num(doc_id) - 1
        persisted = True

    return MergeResponse(
        merged_content_md=result.text,
        conflicts=result.conflicts,
        server_version_num=server_version_num,
        persisted=persisted,
    )
