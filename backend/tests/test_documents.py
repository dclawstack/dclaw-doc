import pytest


@pytest.mark.asyncio
async def test_create_document_uses_default_workspace(client, default_workspace_id):
    res = await client.post(
        "/api/v1/documents",
        json={"title": "Hello", "content_md": "# Hi"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["title"] == "Hello"
    assert body["content_md"] == "# Hi"
    assert body["workspace_id"] == default_workspace_id
    assert body["status"] == "draft"


@pytest.mark.asyncio
async def test_list_documents_paginates_and_searches(client):
    for i in range(3):
        await client.post("/api/v1/documents", json={"title": f"Note {i}"})
    await client.post("/api/v1/documents", json={"title": "Different"})

    res = await client.get("/api/v1/documents?limit=2&offset=0")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 4
    assert len(body["items"]) == 2

    searched = await client.get("/api/v1/documents?q=Note")
    assert searched.json()["total"] == 3


@pytest.mark.asyncio
async def test_get_update_delete_lifecycle(client):
    created = (await client.post("/api/v1/documents", json={"title": "Draft"})).json()
    doc_id = created["id"]

    got = await client.get(f"/api/v1/documents/{doc_id}")
    assert got.status_code == 200
    assert got.json()["title"] == "Draft"

    patched = await client.patch(
        f"/api/v1/documents/{doc_id}",
        json={"title": "Final", "status": "published"},
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "Final"
    assert patched.json()["status"] == "published"

    deleted = await client.delete(f"/api/v1/documents/{doc_id}")
    assert deleted.status_code == 204

    missing = await client.get(f"/api/v1/documents/{doc_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_workspace_scoping_isolates_documents(client):
    ws_res = await client.post("/api/v1/workspaces", json={"slug": "other", "name": "Other"})
    other_id = ws_res.json()["id"]

    await client.post("/api/v1/documents", json={"title": "in-personal"})
    other = await client.post(
        "/api/v1/documents",
        json={"title": "in-other"},
        headers={"X-Workspace-Id": other_id},
    )
    assert other.status_code == 201

    personal_list = (await client.get("/api/v1/documents")).json()
    assert {d["title"] for d in personal_list["items"]} == {"in-personal"}

    other_list = (
        await client.get("/api/v1/documents", headers={"X-Workspace-Id": other_id})
    ).json()
    assert {d["title"] for d in other_list["items"]} == {"in-other"}


@pytest.mark.asyncio
async def test_invalid_workspace_header_400(client):
    res = await client.get("/api/v1/documents", headers={"X-Workspace-Id": "not-a-uuid"})
    assert res.status_code == 400
