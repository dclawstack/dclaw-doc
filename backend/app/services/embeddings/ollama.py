from __future__ import annotations

import httpx

from app.core.config import settings
from app.services.embeddings.base import EmbeddingProvider


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Uses an Ollama embedding model (e.g. nomic-embed-text)."""

    name = "ollama"

    def __init__(self, model: str | None = None) -> None:
        self.model = model or "nomic-embed-text"
        # nomic-embed-text is 768-dim; allow override via the first embed call.
        self.dim = 768

    async def embed(self, texts: list[str]) -> list[list[float]]:
        url = settings.ollama_url.rstrip("/") + "/api/embeddings"
        out: list[list[float]] = []
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            for text in texts:
                resp = await client.post(url, json={"model": self.model, "prompt": text})
                resp.raise_for_status()
                vec = resp.json().get("embedding", [])
                if vec and self.dim != len(vec):
                    self.dim = len(vec)
                out.append(vec)
        return out
