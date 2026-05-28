import pytest


@pytest.mark.asyncio
async def test_submit_feedback_and_export_jsonl(client):
    res = await client.post(
        "/api/v1/feedback",
        json={
            "mode": "rewrite",
            "prompt": "Make this clearer",
            "suggestion": "The cat sat on the mat.",
            "accepted_text": "The cat was on the mat.",
            "action": "edited",
        },
    )
    assert res.status_code == 201

    await client.post(
        "/api/v1/feedback",
        json={
            "mode": "summarize",
            "prompt": "TLDR",
            "suggestion": "first take",
            "action": "rejected",
        },
    )

    # Export should include the edited row but not the rejected one.
    export = await client.get("/api/v1/feedback/export.jsonl")
    assert export.status_code == 200
    assert export.headers["content-type"].startswith("application/x-ndjson")
    lines = [line for line in export.text.split("\n") if line.strip()]
    assert len(lines) == 1
    import json as _json
    row = _json.loads(lines[0])
    assert row["mode"] == "rewrite"
    assert row["accepted"] == "The cat was on the mat."
