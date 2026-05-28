"""Per-document ACL enforcement.

Roles form a strict ordering: ``viewer < commenter < editor < owner``.
A request that requires ``editor`` is satisfied by ``editor`` or
``owner``.

Resolution order (highest match wins):
  1. The user is the document's ``created_by`` → owner.
  2. An explicit ``DocumentPermission`` row exists for this user → its role.
  3. No matching permission exists and the document has no other
     permissions on file → ``editor`` (legacy workspace-wide access,
     so existing flows / tests don't break).
  4. The document has permissions but none match this user → no role
     (deny).
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.permission import DocumentPermission

ROLE_LEVEL = {
    "viewer": 1,
    "commenter": 2,
    "editor": 3,
    "owner": 4,
}


async def effective_role(
    db: AsyncSession,
    *,
    document: Document,
    user_id: str,
) -> str | None:
    """Return the user's role on this document, or None if denied."""
    if document.created_by and document.created_by == user_id:
        return "owner"

    stmt = select(DocumentPermission).where(
        DocumentPermission.document_id == document.id,
        DocumentPermission.principal_type == "user",
        DocumentPermission.principal_id == user_id,
    )
    explicit = (await db.execute(stmt)).scalar_one_or_none()
    if explicit is not None:
        return explicit.role

    # If nobody has explicit ACL rows for this doc, fall back to
    # workspace-wide editor access. This keeps existing single-tenant
    # flows working without forcing every caller to seed permissions.
    any_stmt = select(DocumentPermission.id).where(
        DocumentPermission.document_id == document.id
    ).limit(1)
    has_any = (await db.execute(any_stmt)).first()
    if has_any is None:
        return "editor"

    return None


async def has_role(
    db: AsyncSession,
    *,
    document: Document,
    user_id: str,
    required: str,
) -> bool:
    role = await effective_role(db, document=document, user_id=user_id)
    if role is None:
        return False
    return ROLE_LEVEL.get(role, 0) >= ROLE_LEVEL[required]
