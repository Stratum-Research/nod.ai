from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx
import json
from typing import AsyncGenerator, Dict, Optional
from app.db.sqlite import (
    create_chat,
    add_message,
    list_chats,
    get_messages,
    delete_chat,
    touch_chat,
)
from app.settings import get_setting, set_setting


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


router = APIRouter(prefix="/openrouter", tags=["openrouter"])


async def _stream_openrouter_chat(
    api_key: str, payload: Dict[str, object]
) -> AsyncGenerator[str, None]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        # Optional but recommended: helps OpenRouter ranking/referrer analytics
        "HTTP-Referer": "https://electron-react-fastapi-template.local",
        "X-Title": "Electron Chat",
        "Content-Type": "application/json",
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
                # Ignore SSE comment/heartbeat lines (e.g., ": OPENROUTER PROCESSING")
                if raw_line.startswith(":"):
                    continue
                # OpenAI-style SSE lines begin with "data: "
                if raw_line.startswith("data: "):
                    data = raw_line[len("data: ") :].strip()
                else:
                    # If it is not a data line, skip silently
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
                    # Reasoning can appear under various keys depending on model/provider
                    reasoning_keys = [
                        "reasoning",
                        "reasoning_content",
                        "rationale",
                        "thoughts",
                    ]
                    reasoning_delta: Optional[str] = None
                    for k in reasoning_keys:
                        v = delta_obj.get(k)
                        if isinstance(v, str) and v:
                            reasoning_delta = v
                            break

                    if reasoning_delta:
                        yield json.dumps(
                            {"type": "reasoning", "delta": reasoning_delta}
                        ) + "\n"
                    if content_delta:
                        yield json.dumps(
                            {"type": "content", "delta": content_delta}
                        ) + "\n"
                except Exception:
                    # Forward as opaque event
                    yield json.dumps({"type": "event", "data": event}) + "\n"


@router.get("/models")
async def list_models(x_openrouter_key: Optional[str] = Header(default=None, alias="x-openrouter-key")):
    # Fallback to stored key if not provided in header
    if not x_openrouter_key:
        x_openrouter_key = get_setting("openrouter_key")
    if not x_openrouter_key:
        raise HTTPException(status_code=400, detail="Missing x-openrouter-key header or stored key")

    headers = {
        "Authorization": f"Bearer {x_openrouter_key}",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{OPENROUTER_BASE_URL}/models", headers=headers)
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        payload = resp.json()
        data = payload.get("data") or payload.get("models") or []

        def is_free(model: dict) -> bool:
            pricing = model.get("pricing") or {}
            values = []
            for v in pricing.values():
                try:
                    values.append(float(v))
                except Exception:
                    # ignore non-numeric
                    continue
            return len(values) == 0 or all(v == 0 for v in values)

        free_models = [m for m in data if is_free(m)]
        return {"data": free_models}


@router.get("/chats")
async def chats():
    rows = list(list_chats())
    return {"chats": [dict(r) for r in rows]}


@router.get("/chats/{chat_id}")
async def chat_messages(chat_id: int):
    rows = list(get_messages(chat_id))
    return {"messages": [dict(r) for r in rows]}


@router.delete("/chats/{chat_id}")
async def delete_chat_route(chat_id: int):
    delete_chat(chat_id)
    return {"ok": True}


@router.post("/settings/key")
async def save_api_key(request: Request):
    """Save the OpenRouter API key to JSON file."""
    body = await request.json()
    key = body.get("key", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Key is required")
    set_setting("openrouter_key", key)
    return {"ok": True}


@router.get("/settings/key")
async def get_api_key():
    """Get the stored OpenRouter API key (without exposing it fully)."""
    key = get_setting("openrouter_key")
    if not key:
        return {"key": None, "exists": False}
    # Return a masked version - just indicate it exists
    # For security, we don't return the actual key, just confirmation it's set
    return {"key": key[:8] + "..." if len(key) > 8 else "***", "exists": True}


@router.post("/chat/stream")
async def chat_stream(
    request: Request, x_openrouter_key: Optional[str] = Header(default=None, alias="x-openrouter-key")
):
    # Fallback to stored key if not provided in header
    if not x_openrouter_key:
        x_openrouter_key = get_setting("openrouter_key")
    if not x_openrouter_key:
        raise HTTPException(status_code=400, detail="Missing x-openrouter-key header or stored key")

    body = await request.json()
    model = body.get("model")
    messages = body.get("messages")
    chat_id = body.get("chat_id")
    if not model or not isinstance(messages, list):
        raise HTTPException(status_code=400, detail="model and messages are required")

    # Enforce free models during beta by validating model is in free list
    try:
        headers = {"Authorization": f"Bearer {x_openrouter_key}"}
        async with httpx.AsyncClient() as client:
            models_resp = await client.get(
                f"{OPENROUTER_BASE_URL}/models", headers=headers
            )
            models_payload = (
                models_resp.json() if models_resp.status_code < 400 else {"data": []}
            )
            data = models_payload.get("data") or models_payload.get("models") or []

            def is_free(model: dict) -> bool:
                pricing = model.get("pricing") or {}
                values = []
                for v in pricing.values():
                    try:
                        values.append(float(v))
                    except Exception:
                        continue
                return len(values) == 0 or all(v == 0 for v in values)

            allowed_ids = {m.get("id") for m in data if is_free(m)}
            if model not in allowed_ids:
                raise HTTPException(status_code=403, detail="Model not allowed in beta")
    except HTTPException:
        raise
    except Exception:
        # If validation fails unexpectedly, default to deny
        raise HTTPException(status_code=403, detail="Model validation failed")

    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
    }

    # If no chat exists yet, create and emit meta first
    if not chat_id:
        # Use first user message as title (trim)
        first_user = next((m for m in messages if m.get("role") == "user"), None)
        title = first_user.get("content", "New Chat")[:60] if first_user else None
        chat_id = create_chat(title)
    else:
        touch_chat(int(chat_id))

    # Persist the latest user message (assume last item is user)
    last = messages[-1] if messages else None
    if last and last.get("role") == "user":
        add_message(int(chat_id), "user", last.get("content", ""))

    async def combined_stream():
        # Emit meta line with chat_id so client can link conversation
        yield json.dumps({"type": "meta", "chat_id": chat_id}) + "\n"
        assistant_accum = ""
        async for chunk in _stream_openrouter_chat(x_openrouter_key, payload):
            # forward already structured JSON lines or deltas
            if chunk.endswith("\n"):
                yield chunk
                try:
                    evt = json.loads(chunk)
                    if evt.get("type") == "content":
                        assistant_accum += evt.get("delta", "")
                except Exception:
                    pass
            else:
                # Plain content delta
                assistant_accum += chunk
                yield chunk
        # Save assistant message at the end
        if assistant_accum:
            add_message(int(chat_id), "assistant", assistant_accum)
            touch_chat(int(chat_id))

    return StreamingResponse(combined_stream(), media_type="text/plain")
