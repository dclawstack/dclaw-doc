"""Yjs collaboration server (2.1).

Implements the y-websocket wire-protocol contract: the server is
protocol-agnostic — it receives opaque binary updates from a peer,
persists each one, and rebroadcasts to other peers on the same document.

Each WebSocket connection is parked in a per-document "room". When a
new peer joins, the server replays the persisted update log so the
peer can hydrate the Yjs document, then forwards live updates as they
arrive.

This is intentionally tight: no merge logic on the server, no awareness
state — the Yjs client owns both. Anything more sophisticated belongs
in a separate service.
"""
from __future__ import annotations

import asyncio
import uuid
from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import asc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.websockets import WebSocket

from app.models.yjs_update import YjsUpdate


@dataclass
class _Peer:
    socket: WebSocket
    author_id: str | None


class CollabRoom:
    """A single document's room. Holds connected peers; broadcasts updates."""

    def __init__(self) -> None:
        self.peers: set[_Peer] = set()
        self._lock = asyncio.Lock()

    async def add(self, peer: _Peer) -> None:
        async with self._lock:
            self.peers.add(peer)

    async def remove(self, peer: _Peer) -> None:
        async with self._lock:
            self.peers.discard(peer)

    async def broadcast(self, payload: bytes, sender: _Peer) -> None:
        async with self._lock:
            targets = [p for p in self.peers if p is not sender]
        for p in targets:
            try:
                await p.socket.send_bytes(payload)
            except Exception:  # noqa: BLE001 — peer disconnected mid-send
                await self.remove(p)


class CollabManager:
    def __init__(self) -> None:
        self._rooms: dict[uuid.UUID, CollabRoom] = defaultdict(CollabRoom)

    def room(self, document_id: uuid.UUID) -> CollabRoom:
        return self._rooms[document_id]


# Module-level singleton: shared across requests within one worker process.
manager = CollabManager()


async def replay_updates(db: AsyncSession, document_id: uuid.UUID) -> list[bytes]:
    stmt = (
        select(YjsUpdate.payload)
        .where(YjsUpdate.document_id == document_id)
        .order_by(asc(YjsUpdate.seq))
    )
    return list((await db.execute(stmt)).scalars().all())


async def append_update(
    db: AsyncSession,
    *,
    document_id: uuid.UUID,
    payload: bytes,
    author_id: str | None,
) -> YjsUpdate:
    next_seq_stmt = select(func.coalesce(func.max(YjsUpdate.seq), 0) + 1).where(
        YjsUpdate.document_id == document_id
    )
    next_seq = (await db.execute(next_seq_stmt)).scalar() or 1
    row = YjsUpdate(
        document_id=document_id, seq=next_seq, payload=payload, author_id=author_id
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def update_count(db: AsyncSession, document_id: uuid.UUID) -> int:
    stmt = select(func.count(YjsUpdate.id)).where(YjsUpdate.document_id == document_id)
    return int((await db.execute(stmt)).scalar() or 0)
