"""Per-block translation that preserves markdown structure.

Splits content into blocks (paragraph / heading / list-item), translates
each block independently via the LLM, and re-assembles with the original
markdown structural prefixes intact. Glossary terms are passed as a
system-prompt addendum.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.config import settings
from app.services.llm import get_provider


@dataclass
class _Block:
    prefix: str  # e.g. "## ", "- ", "" for plain paragraph
    text: str


_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
_BULLET_RE = re.compile(r"^[-*]\s+(.*)$")


def _split_blocks(markdown: str) -> list[_Block]:
    blocks: list[_Block] = []
    buf: list[str] = []
    for raw in markdown.splitlines():
        line = raw.rstrip()
        if not line:
            if buf:
                blocks.append(_Block(prefix="", text="\n".join(buf)))
                buf = []
            continue
        m = _HEADING_RE.match(line)
        if m:
            if buf:
                blocks.append(_Block(prefix="", text="\n".join(buf)))
                buf = []
            blocks.append(_Block(prefix=f"{m.group(1)} ", text=m.group(2)))
            continue
        m = _BULLET_RE.match(line)
        if m:
            if buf:
                blocks.append(_Block(prefix="", text="\n".join(buf)))
                buf = []
            blocks.append(_Block(prefix="- ", text=m.group(1)))
            continue
        buf.append(line)
    if buf:
        blocks.append(_Block(prefix="", text="\n".join(buf)))
    return blocks


async def _translate_block(block: _Block, target_language: str, glossary: dict[str, str]) -> str:
    if not block.text.strip():
        return block.text
    provider = get_provider()
    glossary_lines = "\n".join(f"- {k} → {v}" for k, v in glossary.items())
    system = (
        f"You are a translator. Translate the user's text to {target_language}. "
        "Preserve meaning and tone. Return ONLY the translation, no commentary."
    )
    if glossary_lines:
        system = f"{system}\n\nGlossary (use these exact translations):\n{glossary_lines}"

    chunks: list[str] = []
    async for chunk in provider.stream(system=system, prompt=block.text, model=settings.ai_model):
        if chunk.done:
            break
        if chunk.content:
            chunks.append(chunk.content)
    return "".join(chunks).strip() or block.text


async def translate_markdown(
    markdown: str,
    *,
    target_language: str,
    glossary: dict[str, str] | None = None,
) -> str:
    glossary = glossary or {}
    blocks = _split_blocks(markdown)
    translated_lines: list[str] = []
    for block in blocks:
        out = await _translate_block(block, target_language, glossary)
        translated_lines.append(f"{block.prefix}{out}")
    return "\n\n".join(translated_lines)
