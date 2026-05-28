"""Document export + import helpers.

Tiny standalone functions (no third-party deps) so they work in CI
without extra installs. We trade fidelity for simplicity — the HTML
exporter is a pragmatic markdown subset, good enough for round-trip
within DClaw Doc, not a CommonMark-compliant renderer.
"""
from __future__ import annotations

import html as html_lib
import json
import re

from app.models.document import Document


def export_markdown(doc: Document) -> str:
    title = doc.title or "Untitled"
    body = (doc.content_md or "").rstrip()
    if body:
        return f"# {title}\n\n{body}\n"
    return f"# {title}\n"


_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
_BULLET_RE = re.compile(r"^[-*]\s+(.*)$")


def export_html(doc: Document) -> str:
    """Render a markdown subset (headings, bullets, paragraphs) to HTML."""
    title = doc.title or "Untitled"
    body_lines: list[str] = []
    in_list = False

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            body_lines.append("</ul>")
            in_list = False

    for raw_line in (doc.content_md or "").splitlines():
        line = raw_line.rstrip()
        if not line:
            close_list()
            continue
        m = _HEADING_RE.match(line)
        if m:
            close_list()
            level = len(m.group(1))
            body_lines.append(f"<h{level}>{html_lib.escape(m.group(2))}</h{level}>")
            continue
        m = _BULLET_RE.match(line)
        if m:
            if not in_list:
                body_lines.append("<ul>")
                in_list = True
            body_lines.append(f"  <li>{html_lib.escape(m.group(1))}</li>")
            continue
        close_list()
        body_lines.append(f"<p>{html_lib.escape(line)}</p>")
    close_list()

    body = "\n".join(body_lines)
    return (
        "<!doctype html>\n<html><head>"
        f"<meta charset=\"utf-8\"><title>{html_lib.escape(title)}</title>"
        "</head><body>"
        f"<h1>{html_lib.escape(title)}</h1>\n{body}"
        "</body></html>"
    )


def export_json(doc: Document) -> str:
    return json.dumps(
        {
            "id": str(doc.id),
            "workspace_id": str(doc.workspace_id),
            "title": doc.title,
            "content_md": doc.content_md,
            "content_json": doc.content_json,
            "status": doc.status,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        },
        indent=2,
    )


def parse_markdown_import(text: str) -> tuple[str, str]:
    """Split an uploaded markdown blob into ``(title, body)``.

    Uses the first H1 as the title if present; otherwise falls back to
    the first non-empty line.
    """
    title = ""
    body_lines: list[str] = []
    for idx, raw in enumerate(text.splitlines()):
        line = raw.rstrip()
        if not title:
            if line.startswith("# "):
                title = line[2:].strip()
                continue
            if line.strip():
                title = line.strip()
                # Don't skip — also include in body if it's not an H1.
        body_lines.append(line)
    body = "\n".join(body_lines).strip()
    return title or "Untitled", body
