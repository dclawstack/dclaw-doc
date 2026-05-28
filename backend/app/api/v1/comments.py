import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import authorized_doc, current_workspace_id
from app.core.auth import CurrentUser, current_user
from app.core.config import is_enabled
from app.core.database import get_db
from app.core.utils import utc_now
from app.models.comment import Comment
from app.repositories.comments import CommentRepository
from app.schemas.comments import CommentCreate, CommentRead, CommentUpdate

router = APIRouter()


def _require_enabled() -> None:
    if not is_enabled("comments"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="comments feature is disabled",
        )


@router.post(
    "/documents/{doc_id}/comments",
    response_model=CommentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    doc_id: uuid.UUID,
    payload: CommentCreate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Comment:
    _require_enabled()
    await authorized_doc("commenter", doc_id, workspace_id, user, db)
    comment = Comment(
        document_id=doc_id,
        parent_id=payload.parent_id,
        anchor_block_id=payload.anchor_block_id,
        body=payload.body,
        author_id=user.user_id,
    )
    return await CommentRepository(db).create(comment)


@router.get("/documents/{doc_id}/comments", response_model=list[CommentRead])
async def list_comments(
    doc_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    await authorized_doc("viewer", doc_id, workspace_id, user, db)
    return await CommentRepository(db).list_for_document(doc_id)


@router.patch("/comments/{comment_id}", response_model=CommentRead)
async def update_comment(
    comment_id: uuid.UUID,
    payload: CommentUpdate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    repo = CommentRepository(db)
    comment = await repo.get_by_id(comment_id)
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    await authorized_doc("commenter", comment.document_id, workspace_id, user, db)

    data = payload.model_dump(exclude_unset=True)
    if "body" in data and data["body"] is not None:
        comment.body = data["body"]
    if "resolved" in data:
        comment.resolved_at = utc_now() if data["resolved"] else None
    await db.commit()
    await db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    user: CurrentUser = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    repo = CommentRepository(db)
    comment = await repo.get_by_id(comment_id)
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    await authorized_doc("commenter", comment.document_id, workspace_id, user, db)
    await repo.delete(comment)
