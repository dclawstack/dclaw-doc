from __future__ import annotations

from app.core.config import settings
from app.services.embeddings.base import EmbeddingProvider
from app.services.embeddings.mock import MockEmbeddingProvider


def get_embedding_provider() -> EmbeddingProvider:
    mode = (settings.embedding_provider or "mock").lower()
    if mode == "ollama":
        from app.services.embeddings.ollama import OllamaEmbeddingProvider
        return OllamaEmbeddingProvider()
    return MockEmbeddingProvider()
