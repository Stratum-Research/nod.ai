"""Models API focused on the OpenSource provider."""

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
import json
from app.providers.opensource import get_opensource_provider
from app.db.sqlite import create_chat, add_message, touch_chat


router = APIRouter(prefix="/models", tags=["models"])


@router.get("")
async def list_all_models():
    """List available OpenSource models."""
    try:
        provider = get_opensource_provider()
        models = await provider.list_models()
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to list models: {exc}"
        ) from exc

    return {"data": models}


@router.post("/chat/stream")
async def chat_stream(request: Request):
    """Stream chat from an OpenSource model."""
    body = await request.json()
    model = body.get("model")
    messages = body.get("messages")
    chat_id = body.get("chat_id")

    if not model or not isinstance(messages, list):
        raise HTTPException(status_code=400, detail="model and messages are required")

    try:
        provider = get_opensource_provider()
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail="OpenSource provider not available"
        ) from exc

    model_info = provider.get_model_info(model)
    if not model_info:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{model}' not found in OpenSource registry",
        )

    is_downloaded = provider.check_model_downloaded(
        model_info["repo_id"], model_info["filename"]
    )
    if not is_downloaded:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Model not downloaded. Please download it first using "
                f"/opensource/models/{model}/download"
            ),
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
