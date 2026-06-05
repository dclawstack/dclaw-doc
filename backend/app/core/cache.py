"""Async Redis cache helper.

Best-effort: every operation is a no-op (returns None / silently skips) when
Redis is unavailable, so the app stays correct even without a running Redis.
Configure via the REDIS_URL environment variable (default redis://localhost:6379/0).
"""

from __future__ import annotations

import os
from typing import Optional

from app.core.logging import get_logger

logger = get_logger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

_client = None


def _get_client():
    """Lazily build a redis.asyncio client. Returns None if redis isn't installed."""
    global _client
    if _client is not None:
        return _client
    try:
        from redis import asyncio as aioredis  # type: ignore
    except Exception:  # pragma: no cover - redis not installed
        return None
    try:
        _client = aioredis.from_url(REDIS_URL, decode_responses=True)
    except Exception as exc:  # pragma: no cover - bad config
        logger.warning("cache.client_init_failed", error=str(exc))
        return None
    return _client


async def cache_get(key: str) -> Optional[str]:
    """Return the cached value for ``key`` or None (also None if redis is down)."""
    client = _get_client()
    if client is None:
        return None
    try:
        return await client.get(key)
    except Exception as exc:
        logger.warning("cache.get_failed", key=key, error=str(exc))
        return None


async def cache_set(key: str, value: str, ttl: int = 30) -> bool:
    """Set ``key`` -> ``value`` with a TTL (seconds). Returns False if redis is down."""
    client = _get_client()
    if client is None:
        return False
    try:
        await client.set(key, value, ex=ttl)
        return True
    except Exception as exc:
        logger.warning("cache.set_failed", key=key, error=str(exc))
        return False
