from fastapi import APIRouter

from app.db.sqlite import delete_chat, get_messages, list_chats

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("")
async def chats():
    rows = list(list_chats())
    return {"chats": [dict(r) for r in rows]}


@router.get("/{chat_id}")
async def chat_messages(chat_id: int):
    rows = list(get_messages(chat_id))
    return {"messages": [dict(r) for r in rows]}


@router.delete("/{chat_id}")
async def delete_chat_route(chat_id: int):
    delete_chat(chat_id)
    return {"ok": True}
