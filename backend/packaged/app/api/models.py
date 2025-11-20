"""Unified models API using provider system."""
from fastapi import APIRouter, Request, HTTPException, Header
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict
import json
from app.providers.registry import get_registry, get_provider_for_model
from app.db.sqlite import create_chat, add_message, touch_chat


router = APIRouter(prefix="/models", tags=["models"])


@router.get("")
async def list_all_models(
    x_openrouter_key: Optional[str] = Header(default=None, alias="x-openrouter-key")
):
    """List all available models from all providers."""
    registry = get_registry()
    all_models = []
    
    # Get models from each provider
    for provider_name, provider in registry.get_all_providers().items():
        try:
            if provider_name == "openrouter":
                # OpenRouter needs API key
                if not x_openrouter_key:
                    from app.settings import get_setting
                    x_openrouter_key = get_setting("openrouter_key")
                if x_openrouter_key:
                    # Create provider instance with key
                    from app.providers.openrouter import OpenRouterProvider
                    openrouter_provider = OpenRouterProvider(api_key=x_openrouter_key)
                    models = await openrouter_provider.list_models()
                else:
                    models = []
            else:
                models = await provider.list_models()
            
            all_models.extend(models)
        except Exception as e:
            # Skip providers that fail
            print(f"Error listing models from {provider_name}: {e}")
            continue
    
    return {"data": all_models}


@router.post("/chat/stream")
async def chat_stream(
    request: Request,
    x_openrouter_key: Optional[str] = Header(default=None, alias="x-openrouter-key")
):
    """Stream chat from any provider based on model ID."""
    body = await request.json()
    model = body.get("model")
    messages = body.get("messages")
    chat_id = body.get("chat_id")
    
    if not model or not isinstance(messages, list):
        raise HTTPException(status_code=400, detail="model and messages are required")
    
    # Find provider for this model
    provider = get_provider_for_model(model)
    if not provider:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{model}' not found in any provider"
        )
    
    # Handle OpenRouter separately (needs API key per request)
    if provider.name == "openrouter":
        if not x_openrouter_key:
            from app.settings import get_setting
            x_openrouter_key = get_setting("openrouter_key")
        if not x_openrouter_key:
            raise HTTPException(
                status_code=400,
                detail="Missing x-openrouter-key header or stored key"
            )
        # Re-instantiate with API key for this request
        from app.providers.openrouter import OpenRouterProvider
        provider = OpenRouterProvider(api_key=x_openrouter_key)
    
    # Check if OpenSource model is downloaded
    if provider.name == "opensource":
        model_info = provider._get_model_info(model)
        if model_info:
            is_downloaded = provider.check_model_downloaded(
                model_info["repo_id"],
                model_info["filename"]
            )
            if not is_downloaded:
                raise HTTPException(
                    status_code=400,
                    detail=f"Model not downloaded. Please download it first using /opensource/models/{model}/download"
                )
    
    # Create chat if needed
    if not chat_id:
        first_user = next((m for m in messages if m.get("role") == "user"), None)
        title = first_user.get("content", "New Chat")[:60] if first_user else None
        chat_id = create_chat(title)
    else:
        touch_chat(int(chat_id))
    
    # Persist user message
    last = messages[-1] if messages else None
    if last and last.get("role") == "user":
        add_message(int(chat_id), "user", last.get("content", ""))
    
    async def combined_stream():
        # Emit meta line with chat_id
        yield json.dumps({"type": "meta", "chat_id": chat_id}) + "\n"
        assistant_accum = ""
        
        async for chunk in provider.stream_chat(model, messages):
            if chunk.endswith("\n"):
                yield chunk
                try:
                    evt = json.loads(chunk)
                    if evt.get("type") == "content":
                        assistant_accum += evt.get("delta", "")
                except Exception:
                    pass
            else:
                assistant_accum += chunk
                yield chunk
        
        # Save assistant message
        if assistant_accum:
            add_message(int(chat_id), "assistant", assistant_accum)
            touch_chat(int(chat_id))
    
    return StreamingResponse(combined_stream(), media_type="text/plain")

