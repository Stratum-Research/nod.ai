"""Provider registry and dispatcher."""
from typing import Dict, Optional, List
from app.providers.base import BaseProvider


class ProviderRegistry:
    """Registry for managing multiple LLM providers."""
    
    def __init__(self):
        self._providers: Dict[str, BaseProvider] = {}
    
    def register(self, provider: BaseProvider) -> None:
        """Register a provider."""
        self._providers[provider.name] = provider
    
    def get(self, name: str) -> Optional[BaseProvider]:
        """Get a provider by name."""
        return self._providers.get(name)
    
    def get_provider_for_model(self, model_id: str) -> Optional[BaseProvider]:
        """Find which provider handles a given model ID."""
        for provider in self._providers.values():
            if provider.is_model_available(model_id):
                return provider
        return None
    
    def list_all_models(self) -> Dict[str, List[Dict]]:
        """List all models from all providers (sync, for initialization)."""
        models = {}
        for name, provider in self._providers.items():
            try:
                # This will be async in real usage, but for initialization we can do sync
                models[name] = []
            except Exception:
                models[name] = []
        return models
    
    def get_all_providers(self) -> Dict[str, BaseProvider]:
        """Get all registered providers."""
        return self._providers.copy()


# Global registry instance
_registry = ProviderRegistry()


def get_registry() -> ProviderRegistry:
    """Get the global provider registry."""
    return _registry


def get_provider(name: str) -> Optional[BaseProvider]:
    """Get a provider by name from global registry."""
    return _registry.get(name)


def get_provider_for_model(model_id: str) -> Optional[BaseProvider]:
    """Get the provider that handles a model ID."""
    return _registry.get_provider_for_model(model_id)

