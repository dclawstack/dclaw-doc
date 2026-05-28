"""Compliance helpers — PII detection + audit event recording."""
from __future__ import annotations

import json
import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_event import AuditEvent


_PATTERNS = {
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    "phone": re.compile(r"\b(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d[ -]?){13,19}\b"),
}


def detect_pii(text: str) -> list[dict]:
    findings: list[dict] = []
    for kind, pattern in _PATTERNS.items():
        for match in pattern.finditer(text or ""):
            findings.append(
                {
                    "kind": kind,
                    "value": match.group(0),
                    "start": match.start(),
                    "end": match.end(),
                }
            )
    return findings


def redact(text: str) -> tuple[str, list[dict]]:
    findings: list[dict] = []
    redacted = text or ""
    for kind, pattern in _PATTERNS.items():
        for match in pattern.finditer(redacted):
            findings.append({"kind": kind, "value": match.group(0)})
        redacted = pattern.sub(f"[REDACTED:{kind}]", redacted)
    return redacted, findings


async def record_event(
    db: AsyncSession,
    *,
    workspace_id: uuid.UUID,
    actor_id: str,
    action: str,
    document_id: uuid.UUID | None = None,
    payload: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        workspace_id=workspace_id,
        document_id=document_id,
        actor_id=actor_id,
        action=action,
        payload=json.dumps(payload or {}),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event
