from __future__ import annotations

from app.core.config import settings
from app.services.llm.base import LLMProvider
from app.services.llm.mock import MockProvider


def get_provider() -> LLMProvider:
    """Return the configured LLM provider.

    Imports are lazy so a missing optional dependency doesn't break the
    default ``mock`` path.
    """
    mode = (settings.ai_provider or "mock").lower()
    if mode == "ollama":
        from app.services.llm.ollama import OllamaProvider
        return OllamaProvider()
    if mode == "openrouter":
        from app.services.llm.openrouter import OpenRouterProvider
        return OpenRouterProvider()
    return MockProvider()
