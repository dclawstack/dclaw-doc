"""Cryptographic notarization (2.9).

Hashes the canonical document state (title + content_md) and HMAC-signs
the digest with the workspace key. Anyone with the workspace key can
re-compute the signature later and verify it matches.

This is intentionally simple — no external timestamping authority, no
external blockchain. The story is: every approved version is bound to
an actor and a tamper-evident signature, with a public hash anyone can
re-derive. Upgrading to a TSA / chain anchor later is additive.
"""
from __future__ import annotations

import hashlib
import hmac

from app.core.config import settings
from app.models.document import Document


def canonical_payload(document: Document, version_num: int) -> bytes:
    """Bytes whose hash is the notarized digest."""
    title = document.title or ""
    body = document.content_md or ""
    return f"v{version_num}|{title}|{body}".encode("utf-8")


def content_hash(document: Document, version_num: int) -> str:
    return hashlib.sha256(canonical_payload(document, version_num)).hexdigest()


def sign(content_hash_hex: str) -> str:
    return hmac.new(
        settings.secret_key.encode("utf-8"),
        content_hash_hex.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify(content_hash_hex: str, signature_hex: str) -> bool:
    return hmac.compare_digest(sign(content_hash_hex), signature_hex)
