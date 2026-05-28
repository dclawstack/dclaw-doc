import pytest


@pytest.mark.asyncio
async def test_translate_preserves_structure(client):
    """The mock LLM echoes the prompt's first line, so per-block translation
    leaves each block's text effectively unchanged but markdown structure
    (headings, bullets, paragraphs) must round-trip.
    """
    doc = (await client.post(
        "/api/v1/documents",
        json={
            "title": "Doc",
            "content_md": (
                "# Heading\n\nFirst paragraph.\n\n"
                "- bullet one\n- bullet two\n\nSecond paragraph."
            ),
        },
    )).json()

    res = await client.post(
        f"/api/v1/documents/{doc['id']}/translate",
        json={"target_language": "French"},
    )
    assert res.status_code == 200
    body = res.json()
    md = body["content_md"]
    # Structural prefixes survive translation
    assert md.startswith("# ")
    assert "- " in md
    assert md.count("\n\n") >= 3
    # Translation didn't persist (in_place=False) but title was suffixed
    assert body["title"].endswith("(French)")


@pytest.mark.asyncio
async def test_translate_in_place_persists(client):
    doc = (await client.post(
        "/api/v1/documents", json={"title": "x", "content_md": "Hello world."}
    )).json()
    await client.post(
        f"/api/v1/documents/{doc['id']}/translate",
        json={"target_language": "Spanish", "in_place": True},
    )

    refetched = (await client.get(f"/api/v1/documents/{doc['id']}")).json()
    # in_place updated content_md (mock leaves text as the prompt input
    # since it embeds the head of the prompt verbatim).
    assert refetched["content_md"] != "" and refetched["content_md"] != "Hello world."
