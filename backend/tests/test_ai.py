import pytest


@pytest.mark.asyncio
async def test_doc_chat_streams_sse(client):
    res = await client.post(
        "/api/v1/ai/doc-chat",
        json={"prompt": "Summarize the latest release", "mode": "summarize"},
    )
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")

    body = res.text
    events = [line for line in body.splitlines() if line.startswith("event:")]
    assert events[0] == "event: meta"
    assert "event: token" in events
    assert events[-1] == "event: done"
    # mock provider name is surfaced in the first frame
    assert "\"provider\": \"mock\"" in body


@pytest.mark.asyncio
async def test_doc_chat_uses_document_context(client):
    created = await client.post(
        "/api/v1/documents",
        json={"title": "Spec", "content_md": "# Spec\nbacked by sqlite"},
    )
    doc_id = created.json()["id"]

    res = await client.post(
        "/api/v1/ai/doc-chat",
        json={"document_id": doc_id, "prompt": "What is this about?"},
    )
    assert res.status_code == 200
    # mock streams word-by-word, so check individual tokens from the prompt
    # the canned response embeds the prompt's first line verbatim
    assert '"What ' in res.text
    assert '"about?' in res.text
