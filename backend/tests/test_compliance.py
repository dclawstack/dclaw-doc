import pytest


@pytest.mark.asyncio
async def test_pii_scan_and_redact(client):
    text = "Email me at bob@example.com or call 555-867-5309. SSN 123-45-6789."
    scan = await client.post("/api/v1/compliance/scan", json={"text": text})
    kinds = {f["kind"] for f in scan.json()["findings"]}
    assert {"email", "phone", "ssn"} <= kinds

    redact = await client.post("/api/v1/compliance/redact", json={"text": text})
    body = redact.json()
    assert "[REDACTED:email]" in body["redacted"]
    assert "[REDACTED:phone]" in body["redacted"]
    assert "[REDACTED:ssn]" in body["redacted"]


@pytest.mark.asyncio
async def test_sensitivity_update_creates_audit_event(client):
    doc = (await client.post("/api/v1/documents", json={"title": "Secret"})).json()

    res = await client.patch(
        f"/api/v1/documents/{doc['id']}/sensitivity",
        json={"sensitivity": "confidential"},
    )
    assert res.status_code == 200
    assert res.json()["sensitivity"] == "confidential"

    audit = (await client.get(f"/api/v1/audit?document_id={doc['id']}")).json()
    assert len(audit) == 1
    assert audit[0]["action"] == "sensitivity.change"
    assert "public" in audit[0]["payload"]
    assert "confidential" in audit[0]["payload"]


@pytest.mark.asyncio
async def test_invalid_sensitivity_value_rejected(client):
    doc = (await client.post("/api/v1/documents", json={"title": "x"})).json()
    res = await client.patch(
        f"/api/v1/documents/{doc['id']}/sensitivity",
        json={"sensitivity": "ultra-top-secret"},
    )
    assert res.status_code == 422
