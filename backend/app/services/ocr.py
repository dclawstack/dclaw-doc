"""OCR / vision provider abstraction (2.8).

Two providers today:
  * ``mock``  — deterministic stub returning a fixed transcript so tests
                exercise the full pipeline (upload → text → optional doc).
  * ``ollama`` — uses Ollama's vision-model ``/api/generate`` (e.g. llava)
                with a base64-encoded image.

Real ``openrouter`` vision can be added the same way later.
"""
from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from app.core.config import settings


@dataclass
class OCRResult:
    text: str
    provider: str
    model: str


class OCRProvider(ABC):
    name: str
    model: str

    @abstractmethod
    async def transcribe(self, *, image_b64: str, hint: str | None = None) -> OCRResult:
        raise NotImplementedError


class MockOCRProvider(OCRProvider):
    name = "mock"
    model = "mock-ocr"

    async def transcribe(self, *, image_b64: str, hint: str | None = None) -> OCRResult:
        digest = hashlib.sha256(image_b64.encode("utf-8")).hexdigest()[:8]
        body = (
            f"[mock OCR transcript for image {digest}]\n"
            f"Hint: {hint or 'none'}\n\n"
            "This is a deterministic stub. Set AI_VISION_PROVIDER=ollama "
            "with a vision model (e.g. llava) for real OCR."
        )
        return OCRResult(text=body, provider=self.name, model=self.model)


class OllamaOCRProvider(OCRProvider):
    name = "ollama"

    def __init__(self) -> None:
        self.model = "llava"

    async def transcribe(self, *, image_b64: str, hint: str | None = None) -> OCRResult:
        url = settings.ollama_url.rstrip("/") + "/api/generate"
        prompt = hint or "Transcribe all text in this image, preserving layout."
        payload = {
            "model": self.model,
            "prompt": prompt,
            "images": [image_b64],
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        return OCRResult(text=data.get("response", "").strip(), provider=self.name, model=self.model)


def get_provider() -> OCRProvider:
    mode = (getattr(settings, "ai_vision_provider", "mock") or "mock").lower()
    if mode == "ollama":
        return OllamaOCRProvider()
    return MockOCRProvider()
