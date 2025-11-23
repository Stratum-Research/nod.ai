import os
import sys
import sqlite3
import shutil
from pathlib import Path
from typing import Optional, Iterable
from appdirs import user_data_dir


def get_db_dir() -> Path:
    """Get OS-appropriate user data directory for the app."""
    app_name = "nodai"
    app_author = "stratum-research"
    data_dir = Path(user_data_dir(app_name, app_author))
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def get_db_path() -> Path:
    """Get the database file path in user data directory."""
    return get_db_dir() / "data.sqlite3"


def get_template_db_path() -> Optional[Path]:
    """Get the template database path (in app directory)."""
    # When running from source
    template_path = Path(__file__).parent / "data.sqlite3"
    if template_path.exists():
        return template_path
    
    # When running from PyInstaller bundle
    # PyInstaller creates a temp folder and stores path in _MEIPASS
    if hasattr(sys, '_MEIPASS'):
        template_path = Path(sys._MEIPASS) / "app" / "db" / "data.sqlite3"
        if template_path.exists():
            return template_path
    
    return None


DB_PATH = str(get_db_path())


def get_conn() -> sqlite3.Connection:
    """Get database connection with foreign keys enabled."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Enable foreign key constraints
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Initialize database. Copies template DB on first run if it exists."""
    db_path = get_db_path()
    
    # If DB doesn't exist, try to copy from template
    if not db_path.exists():
        template_path = get_template_db_path()
        if template_path and template_path.exists():
            shutil.copy2(template_path, db_path)
            # After copying, ensure foreign keys are enabled
            conn = get_conn()
            conn.execute("PRAGMA foreign_keys = ON")
            conn.commit()
            conn.close()
            return
    
    # Create tables if they don't exist (for new installations)
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
    # Enable foreign key constraints
    cur.execute("PRAGMA foreign_keys = ON")
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
    """Delete a chat and all its messages (CASCADE handles messages)."""
    conn = get_conn()
    cur = conn.cursor()
    # First delete messages explicitly to ensure they're removed
    # (CASCADE should handle this, but being explicit)
    cur.execute("DELETE FROM messages WHERE chat_id=?", (chat_id,))
    # Then delete the chat
    cur.execute("DELETE FROM chats WHERE id=?", (chat_id,))
    conn.commit()
    conn.close()
