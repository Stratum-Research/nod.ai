"""Base provider interface for LLM providers."""
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, AsyncGenerator


class BaseProvider(ABC):
    """Base class for all LLM providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name identifier."""
        pass

    @abstractmethod
    async def list_models(self, **kwargs) -> List[Dict]:
        """List available models from this provider."""
        pass

    @abstractmethod
    async def stream_chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Stream chat completion from the provider."""
        pass

    @abstractmethod
    def is_model_available(self, model_id: str) -> bool:
        """Check if a model ID belongs to this provider."""
        pass

