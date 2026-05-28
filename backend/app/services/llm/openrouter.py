from __future__ import annotations

import json
from typing import AsyncIterator

import httpx

from app.core.config import settings
from app.services.llm.base import LLMProvider, LLMStreamChunk


class OpenRouterProvider(LLMProvider):
    """Stream completions from OpenRouter's OpenAI-compatible API."""

    name = "openrouter"

    def __init__(self) -> None:
        if not settings.openrouter_api_key:
            raise RuntimeError(
                "OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter"
            )

    async def stream(
        self,
        *,
        system: str | None,
        prompt: str,
        model: str,
    ) -> AsyncIterator[LLMStreamChunk]:
        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model or settings.ai_model,
            "messages": messages,
            "stream": True,
        }
        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }
        url = settings.openrouter_base_url.rstrip("/") + "/chat/completions"
        timeout = httpx.Timeout(60.0, read=300.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data_str = line[len("data:"):].strip()
                    if data_str == "[DONE]":
                        yield LLMStreamChunk(content="", done=True)
                        return
                    try:
                        data = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    choices = data.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if content:
                        yield LLMStreamChunk(content=content)
