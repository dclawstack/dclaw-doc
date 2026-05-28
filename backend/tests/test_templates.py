import pytest


@pytest.mark.asyncio
async def test_create_list_template(client):
    created = await client.post(
        "/api/v1/templates",
        json={
            "name": "meeting-notes",
            "description": "Standard weekly template",
            "content_md": "# {{title}}\n\nAttendees: {{attendees}}",
            "variables": [
                {"name": "title", "default": "Weekly sync"},
                {"name": "attendees"},
            ],
        },
    )
    assert created.status_code == 201, created.text

    listed = (await client.get("/api/v1/templates")).json()
    assert [t["name"] for t in listed] == ["meeting-notes"]


@pytest.mark.asyncio
async def test_render_template_substitutes_variables(client):
    tmpl = (await client.post(
        "/api/v1/templates",
        json={
            "name": "release",
            "content_md": "Release {{version}} ships on {{date}}.",
            "variables": [
                {"name": "version"},
                {"name": "date", "default": "TBD"},
            ],
        },
    )).json()

    doc = await client.post(
        f"/api/v1/templates/{tmpl['id']}/render",
        json={"variables": {"version": "1.2"}, "title": "Release 1.2"},
    )
    assert doc.status_code == 201
    body = doc.json()
    assert body["title"] == "Release 1.2"
    # version was supplied, date falls back to default
    assert body["content_md"] == "Release 1.2 ships on TBD."


@pytest.mark.asyncio
async def test_duplicate_template_name_409(client):
    await client.post("/api/v1/templates", json={"name": "report", "content_md": ""})
    dup = await client.post("/api/v1/templates", json={"name": "report", "content_md": ""})
    assert dup.status_code == 409
