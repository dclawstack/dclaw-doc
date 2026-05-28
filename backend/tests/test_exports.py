import json

import pytest


@pytest.mark.asyncio
async def test_export_markdown(client):
    doc = (await client.post(
        "/api/v1/documents",
        json={"title": "Release", "content_md": "Body text\n- item one"},
    )).json()
    res = await client.get(f"/api/v1/documents/{doc['id']}/export?fmt=md")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/markdown")
    assert res.text.startswith("# Release")
    assert "Body text" in res.text


@pytest.mark.asyncio
async def test_export_html(client):
    doc = (await client.post(
        "/api/v1/documents",
        json={"title": "List", "content_md": "# Heading\n- one\n- two\n\nPara"},
    )).json()
    res = await client.get(f"/api/v1/documents/{doc['id']}/export?fmt=html")
    assert res.status_code == 200
    body = res.text
    assert "<h1>List</h1>" in body
    assert "<h1>Heading</h1>" in body
    assert "<li>one</li>" in body
    assert "<p>Para</p>" in body


@pytest.mark.asyncio
async def test_export_json_roundtrip(client):
    created = (await client.post(
        "/api/v1/documents", json={"title": "exp", "content_md": "body"}
    )).json()
    res = await client.get(f"/api/v1/documents/{created['id']}/export?fmt=json")
    body = json.loads(res.text)
    assert body["title"] == "exp"
    assert body["content_md"] == "body"


@pytest.mark.asyncio
async def test_import_markdown_extracts_title(client):
    res = await client.post(
        "/api/v1/imports/markdown",
        json={"content": "# Imported\n\nHello world."},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["title"] == "Imported"
    assert "Hello world." in body["content_md"]
