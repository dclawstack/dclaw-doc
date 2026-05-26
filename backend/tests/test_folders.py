import pytest


@pytest.mark.asyncio
async def test_create_and_list_folders(client, default_workspace_id):
    created = await client.post("/api/v1/folders", json={"name": "Notes"})
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Notes"
    assert body["workspace_id"] == default_workspace_id

    listed = await client.get("/api/v1/folders")
    assert listed.status_code == 200
    assert [f["name"] for f in listed.json()] == ["Notes"]


@pytest.mark.asyncio
async def test_delete_folder(client):
    created = await client.post("/api/v1/folders", json={"name": "Temp"})
    folder_id = created.json()["id"]

    deleted = await client.delete(f"/api/v1/folders/{folder_id}")
    assert deleted.status_code == 204

    listed = await client.get("/api/v1/folders")
    assert listed.json() == []
