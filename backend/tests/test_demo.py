"""DEMO-ONLY tests — remove with the demo router."""
import pytest


@pytest.mark.asyncio
async def test_seed_populates_workspaces_and_docs(client):
    res = await client.post("/api/v1/demo/seed")
    assert res.status_code == 200
    counts = res.json()["seeded"]
    assert counts["workspaces"] == 3
    assert counts["documents"] >= 7
    assert counts["templates"] >= 3
    assert counts["comments"] >= 1

    workspaces = (await client.get("/api/v1/workspaces")).json()
    slugs = {w["slug"] for w in workspaces}
    assert {"personal", "legal", "clinical"} <= slugs


@pytest.mark.asyncio
async def test_seed_is_idempotent(client):
    first = (await client.post("/api/v1/demo/seed")).json()["seeded"]
    second = (await client.post("/api/v1/demo/seed")).json()["seeded"]
    # Same content on both calls because seed resets first.
    assert first == second


@pytest.mark.asyncio
async def test_reset_clears_demo_content(client):
    await client.post("/api/v1/demo/seed")

    res = await client.post("/api/v1/demo/reset")
    assert res.status_code == 200

    workspaces = (await client.get("/api/v1/workspaces")).json()
    slugs = {w["slug"] for w in workspaces}
    assert slugs == {"personal"}, f"reset should leave only personal; got {slugs}"

    docs = (await client.get("/api/v1/documents")).json()["items"]
    assert docs == []


@pytest.mark.asyncio
async def test_demo_endpoints_404_when_disabled(client, monkeypatch):
    from app.core import config as config_module

    monkeypatch.setitem(config_module.settings.features, "demo_endpoints", False)
    assert (await client.post("/api/v1/demo/seed")).status_code == 404
    assert (await client.post("/api/v1/demo/reset")).status_code == 404
