import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.repositories.documents import DocumentRepository
from app.services.collab import (
    _Peer,  # private but stable within this module pair
    append_update,
    manager,
    replay_updates,
)

router = APIRouter()


@router.websocket("/documents/{doc_id}/sync")
async def yjs_sync(
    websocket: WebSocket,
    doc_id: uuid.UUID,
    workspace_id: str | None = Query(default=None),
    author_id: str | None = Query(default=None),
):
    """Yjs sync WebSocket (2.1).

    Wire protocol is opaque binary frames — the server doesn't interpret
    them, it just persists and rebroadcasts. The client side runs
    ``y-websocket``-compatible code that handles the actual Yjs sync /
    awareness protocols.
    """
    await websocket.accept()

    if workspace_id is None:
        await websocket.close(code=4400, reason="workspace_id query param required")
        return
    try:
        ws_id = uuid.UUID(workspace_id)
    except ValueError:
        await websocket.close(code=4400, reason="workspace_id must be a UUID")
        return

    # Validate the document belongs to this workspace before joining.
    async with AsyncSession(engine, expire_on_commit=False) as session:
        doc = await DocumentRepository(session).get_for_workspace(ws_id, doc_id)
        if doc is None:
            await websocket.close(code=4404, reason="document not found")
            return

        # Hydrate the new peer by replaying the persisted update log.
        for payload in await replay_updates(session, doc_id):
            await websocket.send_bytes(payload)

    room = manager.room(doc_id)
    peer = _Peer(socket=websocket, author_id=author_id)
    await room.add(peer)

    try:
        while True:
            message = await websocket.receive()
            if "bytes" in message and message["bytes"] is not None:
                payload: bytes = message["bytes"]
                async with AsyncSession(engine, expire_on_commit=False) as session:
                    await append_update(
                        session,
                        document_id=doc_id,
                        payload=payload,
                        author_id=author_id,
                    )
                await room.broadcast(payload, sender=peer)
            elif "text" in message and message["text"] is not None:
                # Ignore stray text frames — Yjs is binary only.
                continue
            else:
                break
    except WebSocketDisconnect:
        pass
    finally:
        await room.remove(peer)
