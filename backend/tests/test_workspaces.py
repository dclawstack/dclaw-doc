import pytest


@pytest.mark.asyncio
async def test_create_and_list_workspace(client):
    res = await client.post("/api/v1/workspaces", json={"slug": "acme", "name": "Acme"})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["slug"] == "acme"
    assert body["name"] == "Acme"
    assert "id" in body and "created_at" in body

    listed = await client.get("/api/v1/workspaces")
    assert listed.status_code == 200
    slugs = {w["slug"] for w in listed.json()}
    assert {"personal", "acme"} <= slugs


@pytest.mark.asyncio
async def test_duplicate_workspace_slug_409(client):
    await client.post("/api/v1/workspaces", json={"slug": "team", "name": "Team"})
    dup = await client.post("/api/v1/workspaces", json={"slug": "team", "name": "Other"})
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_get_workspace_404(client):
    res = await client.get("/api/v1/workspaces/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404
