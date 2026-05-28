"""Document versioning service.

Snapshots are created before a document is mutated, capturing the
pre-change state. This way, the version list always represents prior
states and rollback restores the document to the snapshot's content.
"""
from __future__ import annotations

from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.repositories.document_versions import DocumentVersionRepository


async def snapshot(
    repo: DocumentVersionRepository,
    *,
    document: Document,
    author_id: str | None = None,
) -> DocumentVersion:
    version_num = await repo.next_version_num(document.id)
    version = DocumentVersion(
        document_id=document.id,
        version_num=version_num,
        title=document.title,
        content_md=document.content_md,
        content_json=document.content_json,
        author_id=author_id,
    )
    return await repo.create(version)


def has_content_changed(document: Document, patch: dict) -> bool:
    """Whether a PATCH payload would actually mutate versioned fields."""
    for field in ("title", "content_md", "content_json"):
        if field in patch and patch[field] is not None and patch[field] != getattr(document, field):
            return True
    return False
