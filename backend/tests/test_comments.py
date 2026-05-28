import pytest


@pytest.mark.asyncio
async def test_create_list_and_thread_comments(client):
    doc_id = (await client.post("/api/v1/documents", json={"title": "discussion"})).json()["id"]

    root = await client.post(
        f"/api/v1/documents/{doc_id}/comments",
        json={"body": "First take", "anchor_block_id": "block-1"},
    )
    assert root.status_code == 201
    root_id = root.json()["id"]

    reply = await client.post(
        f"/api/v1/documents/{doc_id}/comments",
        json={"body": "Reply to first", "parent_id": root_id},
    )
    assert reply.status_code == 201
    assert reply.json()["parent_id"] == root_id

    listed = (await client.get(f"/api/v1/documents/{doc_id}/comments")).json()
    assert [c["body"] for c in listed] == ["First take", "Reply to first"]


@pytest.mark.asyncio
async def test_resolve_and_delete_comment(client):
    doc_id = (await client.post("/api/v1/documents", json={"title": "x"})).json()["id"]
    cmt = (await client.post(
        f"/api/v1/documents/{doc_id}/comments", json={"body": "todo"}
    )).json()

    resolved = await client.patch(
        f"/api/v1/comments/{cmt['id']}", json={"resolved": True}
    )
    assert resolved.status_code == 200
    assert resolved.json()["resolved_at"] is not None

    deleted = await client.delete(f"/api/v1/comments/{cmt['id']}")
    assert deleted.status_code == 204
    listed = (await client.get(f"/api/v1/documents/{doc_id}/comments")).json()
    assert listed == []
