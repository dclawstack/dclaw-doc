"""Deterministic mock embedding provider.

Produces a 128-dimensional float vector from a hash of the input. Same
text → same vector. Useful for end-to-end RAG tests with zero external
dependencies. Quality is obviously not real, but the pipeline shape is
identical to a real embedder.
"""
from __future__ import annotations

import hashlib
import math

from app.services.embeddings.base import EmbeddingProvider


class MockEmbeddingProvider(EmbeddingProvider):
    name = "mock"
    model = "mock-hash-128"
    dim = 128

    def _embed_one(self, text: str) -> list[float]:
        # Use repeated SHA-256 of (counter || text) to fill ``dim`` floats.
        normalised = text.strip().lower()
        floats: list[float] = []
        counter = 0
        while len(floats) < self.dim:
            digest = hashlib.sha256(f"{counter}|{normalised}".encode()).digest()
            for i in range(0, len(digest), 2):
                if len(floats) >= self.dim:
                    break
                # Two bytes → signed int → scaled to [-1, 1]
                value = int.from_bytes(digest[i : i + 2], "big", signed=False)
                floats.append((value / 32767.5) - 1.0)
            counter += 1

        # L2-normalise so cosine similarity == dot product.
        norm = math.sqrt(sum(v * v for v in floats))
        if norm > 0:
            floats = [v / norm for v in floats]
        return floats

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(t) for t in texts]
