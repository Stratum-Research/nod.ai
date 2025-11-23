"""Helpers for the OpenSource provider singleton."""

from functools import lru_cache

from app.providers.provider import OpenSourceProvider


@lru_cache(maxsize=1)
def get_opensource_provider() -> OpenSourceProvider:
    """Return a cached OpenSourceProvider instance."""
    return OpenSourceProvider()


__all__ = ["OpenSourceProvider", "get_opensource_provider"]
