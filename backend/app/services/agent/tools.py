"""Tool registry for the agentic copilot.

Each tool exposes a JSON-Schema-shaped ``parameters`` dict and an async
``handler`` that receives the workspace context + parsed arguments and
returns a JSON-serialisable payload.

Real provider integration (Claude tool-use, OpenAI function-calling)
just needs to convert ``REGISTERED_TOOLS`` into the provider's schema
format. The MockProvider in this repo recognises a tiny ``[tool: name]``
shorthand so the loop is testable without a real LLM.
"""
from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.repositories.documents import DocumentRepository
from app.repositories.templates import TemplateRepository
from app.services.rag import hybrid_search


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: dict
    handler: Callable[[AsyncSession, uuid.UUID, dict], Awaitable[dict]]


# --- Handlers ---

async def _search_workspace(db: AsyncSession, workspace_id: uuid.UUID, args: dict) -> dict:
    query = str(args.get("query") or "").strip()
    top_k = int(args.get("top_k") or 5)
    if not query:
        return {"hits": []}
    hits = await hybrid_search(db, workspace_id=workspace_id, query=query, top_k=top_k)
    return {
        "hits": [
            {
                "document_id": str(h.document_id),
                "document_title": h.document_title,
                "ordinal": h.ordinal,
                "score": round(h.score, 3),
                "excerpt": h.text[:300],
            }
            for h in hits
        ]
    }


async def _create_doc_from_template(
    db: AsyncSession, workspace_id: uuid.UUID, args: dict
) -> dict:
    template_name = str(args.get("template") or "").strip()
    variables = args.get("variables") or {}
    if not template_name:
        return {"error": "template name is required"}

    stmt = select(TemplateRepository(db).model.__table__).where(
        TemplateRepository(db).model.workspace_id == workspace_id,
        TemplateRepository(db).model.name == template_name,
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        return {"error": f"template '{template_name}' not found"}
    template_id = row[0]

    template = await TemplateRepository(db).get_for_workspace(workspace_id, template_id)
    if template is None:
        return {"error": "template not found"}

    rendered = template.content_md
    for name, value in variables.items():
        rendered = rendered.replace("{{" + str(name) + "}}", str(value))

    doc = Document(
        workspace_id=workspace_id,
        title=str(args.get("title") or template.name),
        content_md=rendered,
    )
    saved = await DocumentRepository(db).create(doc)
    return {"document_id": str(saved.id), "title": saved.title}


_PII_PATTERNS = {
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    "phone": re.compile(r"\b(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
}


async def _redact_pii(db: AsyncSession, workspace_id: uuid.UUID, args: dict) -> dict:
    text = str(args.get("text") or "")
    findings: list[dict] = []
    redacted = text
    for kind, pattern in _PII_PATTERNS.items():
        for match in pattern.finditer(text):
            findings.append({"kind": kind, "value": match.group(0)})
        redacted = pattern.sub(f"[REDACTED:{kind}]", redacted)
    return {"redacted": redacted, "findings": findings}


async def _summarize_doc(db: AsyncSession, workspace_id: uuid.UUID, args: dict) -> dict:
    raw_id = args.get("document_id")
    try:
        doc_id = uuid.UUID(str(raw_id))
    except (TypeError, ValueError):
        return {"error": "document_id must be a UUID"}
    doc = await DocumentRepository(db).get_for_workspace(workspace_id, doc_id)
    if doc is None:
        return {"error": "document not found"}
    # Deterministic summary stub — first 240 chars of content, plus title.
    summary = (doc.content_md or "").strip()[:240]
    return {"title": doc.title, "summary": summary}


REGISTERED_TOOLS: list[ToolSpec] = [
    ToolSpec(
        name="search_workspace",
        description="Hybrid (semantic + keyword) search across this workspace.",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "top_k": {"type": "integer", "minimum": 1, "maximum": 50},
            },
            "required": ["query"],
        },
        handler=_search_workspace,
    ),
    ToolSpec(
        name="create_doc_from_template",
        description="Render a template into a new document.",
        parameters={
            "type": "object",
            "properties": {
                "template": {"type": "string"},
                "title": {"type": "string"},
                "variables": {"type": "object"},
            },
            "required": ["template"],
        },
        handler=_create_doc_from_template,
    ),
    ToolSpec(
        name="redact_pii",
        description="Detect and redact emails / phone numbers / US SSNs in a text snippet.",
        parameters={
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
        handler=_redact_pii,
    ),
    ToolSpec(
        name="summarize_doc",
        description="Return a short summary of an existing document by id.",
        parameters={
            "type": "object",
            "properties": {"document_id": {"type": "string"}},
            "required": ["document_id"],
        },
        handler=_summarize_doc,
    ),
]


_TOOLS_BY_NAME = {t.name: t for t in REGISTERED_TOOLS}


def get_tool(name: str) -> ToolSpec | None:
    return _TOOLS_BY_NAME.get(name)


def tools_summary() -> str:
    """One-line-per-tool human description, used to seed the agent prompt."""
    return "\n".join(
        f"- {t.name}({json.dumps(list(t.parameters.get('properties', {}).keys()))}): {t.description}"
        for t in REGISTERED_TOOLS
    )
