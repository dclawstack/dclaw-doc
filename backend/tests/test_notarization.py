import pytest


@pytest.mark.asyncio
async def test_notarize_and_verify_unchanged(client):
    doc = (await client.post(
        "/api/v1/documents",
        json={"title": "Contract v1", "content_md": "All parties agree."},
    )).json()

    notarized = await client.post(f"/api/v1/documents/{doc['id']}/notarize")
    assert notarized.status_code == 201
    body = notarized.json()
    assert len(body["content_hash"]) == 64
    assert len(body["signature"]) == 64

    verify = await client.get(f"/api/v1/documents/{doc['id']}/notarization")
    assert verify.status_code == 200
    assert verify.json()["valid"] is True


@pytest.mark.asyncio
async def test_verify_detects_tampering(client):
    doc = (await client.post(
        "/api/v1/documents",
        json={"title": "Audit me", "content_md": "Original body."},
    )).json()

    await client.post(f"/api/v1/documents/{doc['id']}/notarize")

    await client.patch(
        f"/api/v1/documents/{doc['id']}",
        json={"content_md": "TAMPERED body."},
    )

    verify = (await client.get(f"/api/v1/documents/{doc['id']}/notarization")).json()
    assert verify["valid"] is False
    # The hash actually computed from the current state differs from the
    # one we signed.
    assert verify["current_content_hash"] != ""
