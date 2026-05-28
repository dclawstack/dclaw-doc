"""Agentic tool-calling tests.

The full /api/v1/ai/agent endpoint runs against the MockProvider, which
never emits a tool-call shorthand, so the loop short-circuits on the
first turn with a "final" step. To exercise the multi-step path we test
``AgentRunner`` directly with a hand-rolled scripted provider.
"""
from __future__ import annotations

import json
from typing import AsyncIterator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DEFAULT_WORKSPACE_SLUG
from app.repositories.workspaces import WorkspaceRepository
from app.services.agent import AgentRunner
from app.services.agent.tools import REGISTERED_TOOLS, get_tool
from app.services.llm.base import LLMProvider, LLMStreamChunk
from tests.conftest import test_engine


class _ScriptedProvider(LLMProvider):
    name = "scripted"

    def __init__(self, replies: list[str]) -> None:
        self._replies = list(replies)

    async def stream(self, *, system: str, prompt: str, model: str) -> AsyncIterator[LLMStreamChunk]:
        text = self._replies.pop(0) if self._replies else ""
        if text:
            yield LLMStreamChunk(content=text)
        yield LLMStreamChunk(content="", done=True, prompt_tokens=1, completion_tokens=1)


async def _personal_workspace_id():
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        ws = await WorkspaceRepository(session).get_by_slug(DEFAULT_WORKSPACE_SLUG)
        assert ws is not None
        return ws.id


def test_tool_registry_includes_core_tools():
    names = {t.name for t in REGISTERED_TOOLS}
    assert {"search_workspace", "redact_pii", "summarize_doc"} <= names
    assert get_tool("search_workspace") is not None
    assert get_tool("does_not_exist") is None


@pytest.mark.asyncio
async def test_redact_pii_tool_finds_email_and_phone():
    redact = get_tool("redact_pii")
    assert redact is not None
    workspace_id = await _personal_workspace_id()
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        result = await redact.handler(
            session,
            workspace_id,
            {"text": "Mail me at alice@example.com or call 555-867-5309."},
        )
    kinds = {f["kind"] for f in result["findings"]}
    assert {"email", "phone"} <= kinds
    assert "[REDACTED:email]" in result["redacted"]
    assert "[REDACTED:phone]" in result["redacted"]


@pytest.mark.asyncio
async def test_agent_runner_executes_tool_then_finalizes():
    workspace_id = await _personal_workspace_id()
    scripted = _ScriptedProvider(
        replies=[
            # Turn 1: request the redact_pii tool
            '[tool: redact_pii] ' + json.dumps({"text": "alice@example.com"}),
            # Turn 2: final answer using the tool result
            "Redacted the email as requested.",
        ]
    )
    runner = AgentRunner(provider=scripted)

    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        run = await runner.run(
            db=session,
            workspace_id=workspace_id,
            prompt="Please redact alice@example.com from this message",
        )

    assert len(run.steps) == 2
    assert run.steps[0].kind == "tool_call"
    assert run.steps[0].tool == "redact_pii"
    assert run.steps[0].result is not None and "[REDACTED:email]" in run.steps[0].result["redacted"]
    assert run.steps[1].kind == "final"
    assert "Redacted" in run.final_answer


@pytest.mark.asyncio
async def test_agent_runner_handles_unknown_tool():
    workspace_id = await _personal_workspace_id()
    scripted = _ScriptedProvider(
        replies=[
            "[tool: not_a_real_tool] {}",
            "Sorry, that tool isn't available.",
        ]
    )
    runner = AgentRunner(provider=scripted)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        run = await runner.run(db=session, workspace_id=workspace_id, prompt="x")
    assert run.steps[0].result == {"error": "unknown tool 'not_a_real_tool'"}
    assert run.final_answer.startswith("Sorry")


@pytest.mark.asyncio
async def test_agent_endpoint_returns_final_answer(client):
    res = await client.post(
        "/api/v1/ai/agent",
        json={"prompt": "Hi copilot"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "final_answer" in body
    assert isinstance(body["steps"], list)


@pytest.mark.asyncio
async def test_workspace_chat_streams_sse(client):
    await client.post(
        "/api/v1/documents",
        json={"title": "Workspace fact", "content_md": "Pluto was reclassified in 2006."},
    )
    res = await client.post(
        "/api/v1/ai/chat",
        json={"prompt": "When was Pluto reclassified?"},
    )
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    body = res.text
    assert "event: meta" in body
    assert "event: citations" in body
    assert "Pluto" in body
