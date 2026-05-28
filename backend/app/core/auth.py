"""Authentication primitives.

Two modes, switched via ``settings.auth_mode``:

- ``dev`` (default) — accept any bearer token (or none); used for local dev
  and tests. Workspace + user are resolved from headers / claims if present
  or fall back to the seeded ``personal`` workspace.
- ``logto`` — verify a Logto-issued JWT against the tenant JWKS. Workspace
  id is read from the ``workspace_id`` custom claim, user id from ``sub``.

The same dependency is used by every protected route — the route handler
just declares ``user: CurrentUser = Depends(current_user)`` and gets a
resolved ``user_id`` + ``workspace_id``.
"""
from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from app.core.config import settings


@dataclass
class CurrentUser:
    user_id: str
    workspace_id: uuid.UUID
    raw_claims: dict


_jwks_client_cache: dict[str, tuple[float, PyJWKClient]] = {}
_JWKS_TTL_SECONDS = 3600


def _jwks_client() -> PyJWKClient:
    """Return a cached JWKS client for the configured Logto endpoint."""
    if not settings.logto_endpoint:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="auth_mode=logto requires LOGTO_ENDPOINT",
        )
    jwks_url = f"{settings.logto_endpoint.rstrip('/')}/oidc/jwks"
    now = time.monotonic()
    cached = _jwks_client_cache.get(jwks_url)
    if cached and (now - cached[0]) < _JWKS_TTL_SECONDS:
        return cached[1]
    client = PyJWKClient(jwks_url)
    _jwks_client_cache[jwks_url] = (now, client)
    return client


def _verify_logto_token(token: str) -> dict:
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=["RS256", "ES256", "ES384"],
            audience=settings.logto_app_id,
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        ) from exc


def _decode_dev_token(token: str | None) -> dict:
    """Dev-mode token: optional JSON payload after ``dev.`` prefix.

    Examples (all valid):
        Authorization: Bearer dev.eyJ1c2VyX2lkIjoidS0xIn0  (base64-encoded JSON)
        Authorization: Bearer dev.{"user_id":"u-1","workspace_id":"<uuid>"}
        (no header at all)                              → anonymous dev user
    """
    if not token:
        return {}
    if not token.startswith("dev."):
        # Treat opaque dev tokens as anonymous — never reject in dev mode
        return {}
    payload = token.removeprefix("dev.")
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        # Try base64-decoded JSON (matches the JWT body shape)
        import base64
        try:
            decoded = base64.urlsafe_b64decode(payload + "==")
            return json.loads(decoded)
        except (ValueError, json.JSONDecodeError):
            return {}


async def current_user(
    authorization: str | None = Header(default=None),
) -> CurrentUser:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()

    if settings.auth_mode == "logto":
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing bearer token",
            )
        claims = _verify_logto_token(token)
    else:  # dev
        claims = _decode_dev_token(token)

    user_id = claims.get("sub") or claims.get("user_id") or "dev-user"
    workspace_claim = claims.get("workspace_id")
    workspace_id: uuid.UUID | None = None
    if workspace_claim:
        try:
            workspace_id = uuid.UUID(workspace_claim)
        except (TypeError, ValueError):
            workspace_id = None

    # In dev mode, defer workspace resolution to the existing
    # current_workspace_id helper (header → default workspace) if the claim
    # didn't carry one. The deps module passes this through.
    if workspace_id is None:
        workspace_id = uuid.UUID(int=0)  # sentinel — replaced by deps layer

    return CurrentUser(user_id=user_id, workspace_id=workspace_id, raw_claims=claims)
