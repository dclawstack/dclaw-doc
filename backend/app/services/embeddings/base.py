from __future__ import annotations

from abc import ABC, abstractmethod


class EmbeddingProvider(ABC):
    """Minimal embedding-provider interface.

    All providers return a list of equal-length float vectors, one per
    input. Dimensions are provider-defined and exposed as ``dim`` so the
    repository can sanity-check stored data.
    """

    name: str
    model: str
    dim: int

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError
