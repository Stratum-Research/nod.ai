import os
import sqlite3
from typing import Optional, Iterable


DB_PATH = os.path.join(os.path.dirname(__file__), "data.sqlite3")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
        );
        """
    )
    conn.commit()
    conn.close()


def create_chat(title: Optional[str]) -> int:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("INSERT INTO chats(title) VALUES(?)", (title,))
    chat_id = cur.lastrowid
    conn.commit()
    conn.close()
    return int(chat_id)


def touch_chat(chat_id: int, title: Optional[str] = None) -> None:
    conn = get_conn()
    cur = conn.cursor()
    if title is None:
        cur.execute(
            "UPDATE chats SET updated_at=CURRENT_TIMESTAMP WHERE id=?", (chat_id,)
        )
    else:
        cur.execute(
            "UPDATE chats SET title=COALESCE(title, ?), updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (title, chat_id),
        )
    conn.commit()
    conn.close()


def add_message(chat_id: int, role: str, content: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO messages(chat_id, role, content) VALUES(?, ?, ?)",
        (chat_id, role, content),
    )
    cur.execute("UPDATE chats SET updated_at=CURRENT_TIMESTAMP WHERE id=?", (chat_id,))
    conn.commit()
    conn.close()


def list_chats() -> Iterable[sqlite3.Row]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, COALESCE(title, 'New Chat') as title, updated_at FROM chats ORDER BY updated_at DESC"
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def get_messages(chat_id: int) -> Iterable[sqlite3.Row]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT role, content, created_at FROM messages WHERE chat_id=? ORDER BY id ASC",
        (chat_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def delete_chat(chat_id: int) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM chats WHERE id=?", (chat_id,))
    conn.commit()
    conn.close()
