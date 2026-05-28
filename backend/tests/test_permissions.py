import pytest


@pytest.mark.asyncio
async def test_grant_list_and_revoke_permission(client):
    doc_id = (await client.post("/api/v1/documents", json={"title": "p"})).json()["id"]

    grant = await client.post(
        f"/api/v1/documents/{doc_id}/permissions",
        json={"principal_type": "user", "principal_id": "alice", "role": "editor"},
    )
    assert grant.status_code == 201
    perm_id = grant.json()["id"]

    perms = (await client.get(f"/api/v1/documents/{doc_id}/permissions")).json()
    assert [p["principal_id"] for p in perms] == ["alice"]

    # Same principal again → upsert (role change), not duplicate.
    regrant = await client.post(
        f"/api/v1/documents/{doc_id}/permissions",
        json={"principal_type": "user", "principal_id": "alice", "role": "viewer"},
    )
    assert regrant.status_code == 201
    assert regrant.json()["role"] == "viewer"

    revoked = await client.delete(f"/api/v1/documents/{doc_id}/permissions/{perm_id}")
    assert revoked.status_code == 204


@pytest.mark.asyncio
async def test_sharing_link_lifecycle(client):
    doc_id = (await client.post("/api/v1/documents", json={"title": "share"})).json()["id"]

    link = await client.post(
        f"/api/v1/documents/{doc_id}/sharing-links",
        json={"role": "viewer"},
    )
    assert link.status_code == 201
    body = link.json()
    assert body["token"] and len(body["token"]) >= 24
    assert body["role"] == "viewer"

    listed = (await client.get(f"/api/v1/documents/{doc_id}/sharing-links")).json()
    assert len(listed) == 1

    revoked = await client.delete(f"/api/v1/sharing-links/{body['id']}")
    assert revoked.status_code == 204
