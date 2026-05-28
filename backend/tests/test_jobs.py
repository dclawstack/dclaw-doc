import json
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DEFAULT_WORKSPACE_SLUG
from app.models.job import Job
from app.repositories.workspaces import WorkspaceRepository
from app.services.jobs.runner import enqueue, run_job_now
from tests.conftest import test_engine


async def _personal_ws_id():
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        ws = await WorkspaceRepository(s).get_by_slug(DEFAULT_WORKSPACE_SLUG)
        return ws.id


@pytest.mark.asyncio
async def test_enqueue_and_run_reindex_job(client):
    await client.post(
        "/api/v1/documents", json={"title": "Job doc", "content_md": "hello rag"}
    )

    enqueued = await client.post(
        "/api/v1/jobs",
        json={"kind": "doc.reindex_all", "payload": {}},
    )
    assert enqueued.status_code == 201
    job_id = enqueued.json()["id"]

    # Execute the job synchronously for deterministic assertion.
    workspace_id = await _personal_ws_id()
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        job = await s.get(Job, uuid.UUID(job_id))
        finished = await run_job_now(s, job)

    assert finished.status == "succeeded"
    result = json.loads(finished.result or "{}")
    assert result["documents"] >= 1


@pytest.mark.asyncio
async def test_enqueue_unknown_kind_rejected(client):
    res = await client.post(
        "/api/v1/jobs",
        json={"kind": "does-not-exist", "payload": {}},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_translate_job_runs(client):
    doc = (await client.post(
        "/api/v1/documents", json={"title": "T", "content_md": "Original line."}
    )).json()

    workspace_id = await _personal_ws_id()
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        job = await enqueue(
            s,
            workspace_id=workspace_id,
            kind="doc.translate",
            payload={"document_id": doc["id"], "target_language": "German"},
            enqueued_by="test-user",
        )
        finished = await run_job_now(s, job)
    assert finished.status == "succeeded"
