import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_workspace_id
from app.core.database import get_db
from app.core.ssrf import SSRFError, assert_url_safe
from app.core.utils import utc_now
from app.models.embed import LiveEmbed

router = APIRouter()


class EmbedCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    kind: str = Field(pattern=r"^(json_url)$")  # tighten later for sql_view, etc.
    source: HttpUrl


class EmbedRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    kind: str
    source: str
    payload: str
    refreshed_at: datetime | None


@router.post("", response_model=EmbedRead, status_code=status.HTTP_201_CREATED)
async def create_embed(
    payload: EmbedCreate,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    # Reject URLs that resolve to internal/metadata addresses before we ever
    # store (and later fetch) them server-side (SSRF guard).
    try:
        assert_url_safe(str(payload.source))
    except SSRFError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    embed = LiveEmbed(
        workspace_id=workspace_id,
        name=payload.name,
        kind=payload.kind,
        source=str(payload.source),
    )
    db.add(embed)
    await db.commit()
    await db.refresh(embed)
    return embed


@router.get("", response_model=list[EmbedRead])
async def list_embeds(
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LiveEmbed).where(LiveEmbed.workspace_id == workspace_id).order_by(LiveEmbed.name)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/{embed_id}/refresh", response_model=EmbedRead)
async def refresh_embed(
    embed_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LiveEmbed).where(
        LiveEmbed.id == embed_id, LiveEmbed.workspace_id == workspace_id
    )
    embed = (await db.execute(stmt)).scalar_one_or_none()
    if embed is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Embed not found")

    if embed.kind != "json_url":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"unsupported embed kind: {embed.kind}",
        )

    # Re-validate at fetch time (resolves DNS now) so a record stored before
    # the guard — or a rebinding host — can't reach internal addresses (SSRF).
    try:
        assert_url_safe(embed.source)
    except SSRFError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    headers: dict[str, str] = {}
    if embed.etag:
        headers["If-None-Match"] = embed.etag

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(15.0), follow_redirects=False
        ) as client:
            resp = await client.get(embed.source, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"upstream fetch failed: {exc}",
        ) from exc

    if resp.status_code == 304:
        embed.refreshed_at = utc_now()
        await db.commit()
        await db.refresh(embed)
        return embed
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"upstream returned {resp.status_code}",
        )

    embed.payload = resp.text[:200_000]  # cap to keep DB rows reasonable
    embed.etag = resp.headers.get("etag")
    embed.refreshed_at = utc_now()
    await db.commit()
    await db.refresh(embed)
    return embed


@router.delete("/{embed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_embed(
    embed_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LiveEmbed).where(
        LiveEmbed.id == embed_id, LiveEmbed.workspace_id == workspace_id
    )
    embed = (await db.execute(stmt)).scalar_one_or_none()
    if embed is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Embed not found")
    await db.delete(embed)
    await db.commit()
