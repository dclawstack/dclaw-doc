import pytest


@pytest.mark.asyncio
async def test_doc_chat_records_usage(client):
    res = await client.post(
        "/api/v1/ai/doc-chat",
        json={"prompt": "ping", "mode": "chat", "use_rag": False},
    )
    assert res.status_code == 200

    rows = (await client.get("/api/v1/usage")).json()
    assert len(rows) == 1
    row = rows[0]
    assert row["provider"] == "mock"
    assert row["requests"] == 1
    assert row["prompt_tokens"] > 0
    assert row["completion_tokens"] > 0


@pytest.mark.asyncio
async def test_usage_aggregates_across_calls(client):
    for _ in range(3):
        await client.post(
            "/api/v1/ai/doc-chat", json={"prompt": "ping", "use_rag": False}
        )
    rows = (await client.get("/api/v1/usage")).json()
    assert len(rows) == 1
    assert rows[0]["requests"] == 3
