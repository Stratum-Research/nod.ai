"""OpenRouter LLM provider implementation."""
from typing import List, Dict, Optional, AsyncGenerator
import httpx
import json
from fastapi import HTTPException
from app.providers.base import BaseProvider
from app.settings import get_setting


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterProvider(BaseProvider):
    """Provider for OpenRouter API."""
    
    @property
    def name(self) -> str:
        return "openrouter"
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize OpenRouter provider."""
        self.api_key = api_key or get_setting("openrouter_key")
        if not self.api_key:
            raise ValueError("OpenRouter API key not found")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get HTTP headers for OpenRouter requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://electron-react-fastapi-template.local",
            "X-Title": "Electron Chat",
            "Content-Type": "application/json",
        }
    
    async def list_models(self, **kwargs) -> List[Dict]:
        """List available models from OpenRouter."""
        headers = self._get_headers()
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{OPENROUTER_BASE_URL}/models", headers=headers)
            if resp.status_code >= 400:
                raise HTTPException(status_code=resp.status_code, detail=resp.text)
            payload = resp.json()
            data = payload.get("data") or payload.get("models") or []
            
            # Filter free models
            def is_free(model: dict) -> bool:
                pricing = model.get("pricing") or {}
                values = []
                for v in pricing.values():
                    try:
                        values.append(float(v))
                    except Exception:
                        continue
                return len(values) == 0 or all(v == 0 for v in values)
            
            free_models = [m for m in data if is_free(m)]
            return free_models
    
    async def stream_chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Stream chat completion from OpenRouter."""
        headers = self._get_headers()
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
        }
        
        async with httpx.AsyncClient(timeout=None) as client:
            url = f"{OPENROUTER_BASE_URL}/chat/completions"
            async with client.stream("POST", url, headers=headers, json=payload) as r:
                if r.status_code >= 400:
                    text = await r.aread()
                    raise HTTPException(status_code=r.status_code, detail=text.decode())
                
                async for raw_line in r.aiter_lines():
                    if not raw_line:
                        continue
                    # Ignore SSE comment/heartbeat lines
                    if raw_line.startswith(":"):
                        continue
                    # OpenAI-style SSE lines begin with "data: "
                    if raw_line.startswith("data: "):
                        data = raw_line[len("data: "):].strip()
                    else:
                        continue
                    
                    if data == "[DONE]":
                        break
                    
                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    
                    # Extract delta content and reasoning if present
                    try:
                        choice = event["choices"][0]
                        delta_obj = choice.get("delta", {}) or {}
                        content_delta: Optional[str] = delta_obj.get("content")
                        
                        # Reasoning can appear under various keys
                        reasoning_keys = ["reasoning", "reasoning_content", "rationale", "thoughts"]
                        reasoning_delta: Optional[str] = None
                        for k in reasoning_keys:
                            v = delta_obj.get(k)
                            if isinstance(v, str) and v:
                                reasoning_delta = v
                                break
                        
                        if reasoning_delta:
                            yield json.dumps({"type": "reasoning", "delta": reasoning_delta}) + "\n"
                        if content_delta:
                            yield json.dumps({"type": "content", "delta": content_delta}) + "\n"
                    except Exception:
                        # Forward as opaque event
                        yield json.dumps({"type": "event", "data": event}) + "\n"
    
    def is_model_available(self, model_id: str) -> bool:
        """Check if model belongs to OpenRouter."""
        # OpenRouter models don't have a prefix, and are not opensource models
        # This is a default provider - if it doesn't match other providers, it's OpenRouter
        return not model_id.startswith("opensource:")

