import json
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_FEATURES: dict[str, bool] = {
    "ai_copilot": True,
    "rag": True,
    "comments": True,
    "versions": True,
    "templates": True,
    "exports": True,
    "permissions": True,
    "usage": True,
    "tracing": False,
    # DEMO-ONLY flag — set FEATURES='{"demo_endpoints":false}' (or remove
    # this entry + app/api/v1/demo.py) before going to production.
    "demo_endpoints": True,
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    app_name: str = "DClaw Doc"
    app_env: str = "dev"
    debug: bool = True

    database_url: str = "sqlite+aiosqlite:///./dclaw_doc.db"
    # Override for production / CI:
    # postgresql+asyncpg://postgres:postgres@localhost:5432/dclaw_doc

    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60

    # --- Auth (1.1) ---
    # auth_mode: "dev" → accept any bearer (or none) and fall back to default workspace
    #            "logto" → verify against Logto JWKS using logto_endpoint + logto_app_id
    auth_mode: str = "dev"
    logto_endpoint: str | None = None
    logto_app_id: str | None = None

    # --- AI provider (1.2) ---
    # ai_provider: "mock" (default; deterministic, no external deps),
    #              "ollama"   (uses ollama_url),
    #              "openrouter" (uses openrouter_api_key)
    ai_provider: str = "mock"
    ai_model: str = "claude-sonnet-4-6"
    ollama_url: str = "http://localhost:11434"
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Embedding provider for RAG (1.5)
    # "mock" (default; deterministic 128-d hash vectors, no setup),
    # "ollama" (nomic-embed-text via local Ollama)
    embedding_provider: str = "mock"
    rag_top_k: int = 5

    # Vision provider for OCR (2.8): "mock" or "ollama" (llava)
    ai_vision_provider: str = "mock"

    # --- Feature flags (1.13) ---
    # Override via env: FEATURES='{"ai_copilot":true,"rag":true}'
    features: dict[str, bool] = DEFAULT_FEATURES

    @field_validator("features", mode="before")
    @classmethod
    def _parse_features(cls, value):
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError(f"FEATURES must be JSON, got: {value!r}") from exc
            if not isinstance(parsed, dict):
                raise ValueError("FEATURES JSON must decode to an object")
            return {**DEFAULT_FEATURES, **parsed}
        if isinstance(value, dict):
            return {**DEFAULT_FEATURES, **value}
        return value


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def is_enabled(name: str) -> bool:
    return bool(settings.features.get(name, False))
