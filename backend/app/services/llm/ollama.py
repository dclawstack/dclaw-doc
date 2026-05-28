from __future__ import annotations

import json
from typing import AsyncIterator

import httpx

from app.core.config import settings
from app.services.llm.base import LLMProvider, LLMStreamChunk


class OllamaProvider(LLMProvider):
    """Stream completions from a local Ollama server.

    Uses the ``/api/chat`` endpoint with ``stream=true``. Falls back
    silently to the model name in ``settings.ai_model`` if no override
    is passed.
    """

    name = "ollama"

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
        url = settings.ollama_url.rstrip("/") + "/api/chat"
        timeout = httpx.Timeout(60.0, read=300.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if "message" in data and "content" in data["message"]:
                        content = data["message"]["content"]
                        if content:
                            yield LLMStreamChunk(content=content)

                    if data.get("done"):
                        yield LLMStreamChunk(
                            content="",
                            done=True,
                            prompt_tokens=data.get("prompt_eval_count"),
                            completion_tokens=data.get("eval_count"),
                        )
                        return
