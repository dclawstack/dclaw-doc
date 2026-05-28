import pytest

from app.services.merge import three_way_merge


def test_merge_identical_local_and_server_returns_unchanged():
    result = three_way_merge(base="a\nb\nc\n", server="a\nb\nc\n", local="a\nb\nc\n")
    assert result.text == "a\nb\nc\n"
    assert result.conflicts == 0


def test_merge_non_overlapping_edits_combine_cleanly():
    base = "alpha\nbeta\ngamma\n"
    server = "alpha\nBETA\ngamma\n"     # server changed line 2
    local = "alpha\nbeta\nGAMMA\n"      # local changed line 3
    result = three_way_merge(base=base, server=server, local=local)
    assert result.conflicts == 0
    assert "BETA" in result.text
    assert "GAMMA" in result.text


def test_merge_conflict_emits_markers():
    base = "one\ntwo\nthree\n"
    server = "one\nSERVER_TWO\nthree\n"
    local = "one\nLOCAL_TWO\nthree\n"
    result = three_way_merge(base=base, server=server, local=local)
    assert result.conflicts == 1
    assert "<<<<<<< server" in result.text
    assert "=======" in result.text
    assert ">>>>>>> local" in result.text


@pytest.mark.asyncio
async def test_merge_endpoint_persists_clean_merge(client):
    # Setup: create doc, edit it once so we have a version 1.
    doc = (await client.post(
        "/api/v1/documents",
        json={"title": "Merge target", "content_md": "alpha\nbeta\ngamma\n"},
    )).json()
    # PATCH triggers a version snapshot of the original content (v1)
    await client.patch(
        f"/api/v1/documents/{doc['id']}",
        json={"content_md": "alpha\nBETA\ngamma\n"},
    )

    # Client diverged from v1 with a non-overlapping line-3 change.
    res = await client.post(
        f"/api/v1/documents/{doc['id']}/merge",
        json={
            "base_version_num": 1,
            "local_content_md": "alpha\nbeta\nGAMMA\n",
            "persist": True,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["conflicts"] == 0
    assert body["persisted"] is True
    assert "BETA" in body["merged_content_md"]
    assert "GAMMA" in body["merged_content_md"]


@pytest.mark.asyncio
async def test_merge_endpoint_returns_markers_when_conflicting(client):
    doc = (await client.post(
        "/api/v1/documents",
        json={"title": "Conflict", "content_md": "L1\nL2\nL3\n"},
    )).json()
    await client.patch(
        f"/api/v1/documents/{doc['id']}",
        json={"content_md": "L1\nSERVER\nL3\n"},
    )

    res = await client.post(
        f"/api/v1/documents/{doc['id']}/merge",
        json={
            "base_version_num": 1,
            "local_content_md": "L1\nLOCAL\nL3\n",
            "persist": True,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["conflicts"] >= 1
    assert "<<<<<<< server" in body["merged_content_md"]
    assert body["persisted"] is False  # never persists when there are conflicts
