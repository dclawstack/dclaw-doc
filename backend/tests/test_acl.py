"""Verifies the explicit-permission ACL path.

The default test client always presents as "dev-user", so we can't easily
exercise multiple identities through the HTTP layer. Instead, these tests
manipulate ``Document.created_by`` directly on the DB so an HTTP request
encounters a doc owned by *another* user.
"""
import uuid

import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.permission import DocumentPermission
from tests.conftest import test_engine


async def _set_creator(doc_id: str, creator: str) -> None:
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        await s.execute(
            update(Document)
            .where(Document.id == uuid.UUID(doc_id))
            .values(created_by=creator)
        )
        await s.commit()


async def _add_perm(doc_id: str, principal_id: str, role: str) -> None:
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        s.add(
            DocumentPermission(
                document_id=uuid.UUID(doc_id),
                principal_type="user",
                principal_id=principal_id,
                role=role,
            )
        )
        await s.commit()


@pytest.mark.asyncio
async def test_creator_can_read_edit_delete(client):
    """The user who created the doc gets full owner privileges."""
    doc = (await client.post("/api/v1/documents", json={"title": "mine"})).json()
    # default test user is "dev-user"; assert creator was stamped
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        row = await s.get(Document, uuid.UUID(doc["id"]))
        assert row.created_by == "dev-user"

    assert (await client.get(f"/api/v1/documents/{doc['id']}")).status_code == 200
    assert (
        await client.patch(f"/api/v1/documents/{doc['id']}", json={"title": "renamed"})
    ).status_code == 200
    assert (
        await client.delete(f"/api/v1/documents/{doc['id']}")
    ).status_code == 204


@pytest.mark.asyncio
async def test_non_owner_denied_when_explicit_acl_exists(client):
    """Once any DocumentPermission row exists for a doc, the workspace-wide
    fallback turns off — only matched principals (or the creator) get in.
    """
    doc = (await client.post("/api/v1/documents", json={"title": "owned"})).json()
    # Re-stamp the doc as owned by someone else, and grant Bob commenter.
    await _set_creator(doc["id"], "alice")
    await _add_perm(doc["id"], "bob", "commenter")

    # dev-user is neither the creator nor in the ACL list → 403.
    res = await client.get(f"/api/v1/documents/{doc['id']}")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_explicit_viewer_can_read_but_not_edit(client):
    doc = (await client.post("/api/v1/documents", json={"title": "shared"})).json()
    await _set_creator(doc["id"], "alice")
    await _add_perm(doc["id"], "dev-user", "viewer")

    assert (await client.get(f"/api/v1/documents/{doc['id']}")).status_code == 200
    # viewer cannot patch → 403
    res = await client.patch(f"/api/v1/documents/{doc['id']}", json={"title": "nope"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_explicit_editor_can_patch_but_not_delete(client):
    doc = (await client.post("/api/v1/documents", json={"title": "wip"})).json()
    await _set_creator(doc["id"], "alice")
    await _add_perm(doc["id"], "dev-user", "editor")

    assert (
        await client.patch(f"/api/v1/documents/{doc['id']}", json={"title": "edited"})
    ).status_code == 200
    res = await client.delete(f"/api/v1/documents/{doc['id']}")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_list_filters_to_visible_only(client):
    mine = (await client.post("/api/v1/documents", json={"title": "mine"})).json()
    hidden = (await client.post("/api/v1/documents", json={"title": "hidden"})).json()
    await _set_creator(hidden["id"], "alice")
    await _add_perm(hidden["id"], "bob", "viewer")

    items = (await client.get("/api/v1/documents")).json()["items"]
    titles = [d["title"] for d in items]
    assert "mine" in titles
    assert "hidden" not in titles
