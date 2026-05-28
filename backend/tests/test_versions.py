import pytest


@pytest.mark.asyncio
async def test_versions_created_on_content_change(client):
    created = await client.post(
        "/api/v1/documents", json={"title": "v1", "content_md": "first"}
    )
    doc_id = created.json()["id"]

    # Initial state has no prior snapshots.
    listed = await client.get(f"/api/v1/documents/{doc_id}/versions")
    assert listed.status_code == 200
    assert listed.json() == []

    # Updating title creates version 1 capturing the pre-change state.
    await client.patch(f"/api/v1/documents/{doc_id}", json={"title": "v2"})
    # Updating body creates version 2.
    await client.patch(f"/api/v1/documents/{doc_id}", json={"content_md": "second"})

    versions = (await client.get(f"/api/v1/documents/{doc_id}/versions")).json()
    assert [v["version_num"] for v in versions] == [2, 1]
    assert versions[1]["title"] == "v1"      # v1 captured the original title
    assert versions[0]["title"] == "v2"      # v2 captured the post-title state


@pytest.mark.asyncio
async def test_no_version_when_nothing_changes(client):
    created = await client.post("/api/v1/documents", json={"title": "stable"})
    doc_id = created.json()["id"]

    # PATCH with same value — no snapshot expected.
    await client.patch(f"/api/v1/documents/{doc_id}", json={"title": "stable"})

    versions = (await client.get(f"/api/v1/documents/{doc_id}/versions")).json()
    assert versions == []


@pytest.mark.asyncio
async def test_restore_version_rolls_back_content(client):
    created = await client.post(
        "/api/v1/documents", json={"title": "original", "content_md": "v1 body"}
    )
    doc_id = created.json()["id"]

    await client.patch(f"/api/v1/documents/{doc_id}", json={"title": "modified"})

    restored = await client.post(f"/api/v1/documents/{doc_id}/versions/1/restore")
    assert restored.status_code == 200
    body = restored.json()
    assert body["title"] == "original"
    assert body["content_md"] == "v1 body"

    # Restore itself created a new snapshot capturing the modified state.
    versions = (await client.get(f"/api/v1/documents/{doc_id}/versions")).json()
    assert [v["version_num"] for v in versions] == [2, 1]
    assert versions[0]["title"] == "modified"  # the pre-restore state


@pytest.mark.asyncio
async def test_get_version_404(client):
    created = await client.post("/api/v1/documents", json={"title": "x"})
    doc_id = created.json()["id"]

    res = await client.get(f"/api/v1/documents/{doc_id}/versions/99")
    assert res.status_code == 404
