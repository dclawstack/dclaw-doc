import pytest


@pytest.mark.asyncio
async def test_search_ranks_relevant_doc_higher(client):
    await client.post(
        "/api/v1/documents",
        json={
            "title": "Cooking Pasta",
            "content_md": (
                "Boil water with salt. Add pasta and cook for ten minutes. "
                "Drain, then mix with olive oil and parmesan."
            ),
        },
    )
    await client.post(
        "/api/v1/documents",
        json={
            "title": "Bicycle Maintenance",
            "content_md": (
                "Oil the chain regularly. Check tire pressure weekly. "
                "Tighten bolts after every long ride."
            ),
        },
    )

    res = await client.post(
        "/api/v1/ai/search",
        json={"query": "How long do I cook pasta?"},
    )
    assert res.status_code == 200, res.text
    hits = res.json()
    assert hits, "expected at least one hit"
    # Top hit should be the pasta document (keyword overlap drives ranking
    # for the deterministic mock embedder).
    assert hits[0]["document_title"] == "Cooking Pasta"


@pytest.mark.asyncio
async def test_doc_chat_streams_citations(client):
    await client.post(
        "/api/v1/documents",
        json={
            "title": "API Reference",
            "content_md": "POST /api/v1/documents creates a new doc with a title and content.",
        },
    )

    res = await client.post(
        "/api/v1/ai/doc-chat",
        json={"prompt": "What does POST documents do?", "use_rag": True},
    )
    assert res.status_code == 200
    body = res.text
    # Both the meta frame and a citations frame should be present.
    assert "event: meta" in body
    assert "event: citations" in body
    # The cited chunk text must surface in the citations payload.
    assert "POST /api/v1/documents" in body


@pytest.mark.asyncio
async def test_search_disabled_503(client, monkeypatch):
    from app.core import config as config_module

    monkeypatch.setitem(config_module.settings.features, "rag", False)
    res = await client.post("/api/v1/ai/search", json={"query": "anything"})
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_chunks_reindex_on_update(client):
    created = await client.post(
        "/api/v1/documents",
        json={"title": "Notes", "content_md": "Initial body about turtles."},
    )
    doc_id = created.json()["id"]

    res1 = await client.post("/api/v1/ai/search", json={"query": "turtles"})
    assert any("turtles" in h["text"].lower() for h in res1.json())

    await client.patch(
        f"/api/v1/documents/{doc_id}",
        json={"content_md": "New body about elephants only."},
    )

    res2 = await client.post("/api/v1/ai/search", json={"query": "turtles"})
    titles = [h["text"].lower() for h in res2.json()]
    assert not any("turtles" in t for t in titles), \
        "old chunks should be replaced after content update"
