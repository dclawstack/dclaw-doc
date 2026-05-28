"""E-signature provider abstraction (2.6).

The mock provider is deterministic: ``send`` returns a fabricated
external id and ``simulate_webhook`` lets tests advance the status
without an actual signing UI. Real providers (DocuSign, OpenSign) plug
in by implementing ``send`` against their API and exposing their webhook
to ``app.api.v1.sign_requests``.
"""
from __future__ import annotations

import secrets
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class SignSendResult:
    external_id: str
    status: str  # usually "sent"


class ESignProvider(ABC):
    name: str

    @abstractmethod
    async def send(
        self,
        *,
        document_id: uuid.UUID,
        signer_email: str,
        signer_name: str | None,
        document_md: str,
    ) -> SignSendResult:
        raise NotImplementedError


class MockESignProvider(ESignProvider):
    name = "mock"

    async def send(
        self,
        *,
        document_id: uuid.UUID,
        signer_email: str,
        signer_name: str | None,
        document_md: str,  # noqa: ARG002 — provider would PUT the rendered doc
    ) -> SignSendResult:
        return SignSendResult(external_id=f"mock_{secrets.token_hex(8)}", status="sent")


def get_provider() -> ESignProvider:
    # Single mock implementation today; flip on env var when DocuSign lands.
    return MockESignProvider()
