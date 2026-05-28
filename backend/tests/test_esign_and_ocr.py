import base64

import pytest


@pytest.mark.asyncio
async def test_create_sign_request_and_webhook_marks_signed(client):
    doc = (await client.post("/api/v1/documents", json={"title": "Contract"})).json()

    sent = await client.post(
        f"/api/v1/documents/{doc['id']}/sign-requests",
        json={"signer_email": "signer@example.com", "signer_name": "Alex"},
    )
    assert sent.status_code == 201
    body = sent.json()
    assert body["status"] == "sent"
    assert body["external_id"].startswith("mock_")
    external_id = body["external_id"]

    listed = await client.get(f"/api/v1/documents/{doc['id']}/sign-requests")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    # Webhook flips status to signed
    hook = await client.post(
        "/api/v1/sign-requests/webhook",
        json={"external_id": external_id, "status": "signed"},
    )
    assert hook.status_code == 200
    assert hook.json()["status"] == "signed"

    # Audit log captures both events
    audit = (await client.get(f"/api/v1/audit?document_id={doc['id']}")).json()
    actions = [e["action"] for e in audit]
    assert "sign_request.sent" in actions
    assert "sign_request.signed" in actions


@pytest.mark.asyncio
async def test_ocr_mock_returns_deterministic_text(client):
    image_b64 = base64.b64encode(b"fake-image-bytes").decode()
    res = await client.post(
        "/api/v1/ocr",
        json={"image_base64": image_b64, "hint": "invoice"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "mock"
    assert "Hint: invoice" in body["text"]


@pytest.mark.asyncio
async def test_ocr_to_document_creates_doc(client):
    image_b64 = base64.b64encode(b"page").decode()
    res = await client.post(
        "/api/v1/ocr/to-document",
        json={"image_base64": image_b64, "title": "Scanned receipt"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["title"] == "Scanned receipt"
    assert "mock OCR transcript" in body["content_md"]
