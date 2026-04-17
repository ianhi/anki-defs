"""SQLite session management — cards, pending, usage, history, word cache.

Matches Express session.ts schema and API exactly. Uses stdlib sqlite3.
"""

from __future__ import annotations

import sqlite3
import threading
import time
from typing import Any

from ..config import CONFIG_DIR, DB_FILE

# Ensure config dir exists
CONFIG_DIR.mkdir(parents=True, exist_ok=True)

_db: sqlite3.Connection | None = None
_db_lock = threading.Lock()


def _get_db() -> sqlite3.Connection:
    global _db
    if _db is None:
        _db = sqlite3.connect(str(DB_FILE), check_same_thread=False)
        _db.row_factory = sqlite3.Row
        _db.execute("PRAGMA journal_mode = WAL")
        _db.execute("PRAGMA foreign_keys = ON")
        _init_tables(_db)
    return _db


def _init_tables(db: sqlite3.Connection) -> None:
    db.executescript("""
        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY,
            word TEXT NOT NULL,
            definition TEXT NOT NULL,
            nativeDefinition TEXT NOT NULL DEFAULT '',
            exampleSentence TEXT NOT NULL DEFAULT '',
            sentenceTranslation TEXT NOT NULL DEFAULT '',
            createdAt INTEGER NOT NULL,
            noteId INTEGER NOT NULL,
            deckName TEXT NOT NULL,
            modelName TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pending (
            id TEXT PRIMARY KEY,
            word TEXT NOT NULL,
            definition TEXT NOT NULL,
            nativeDefinition TEXT NOT NULL DEFAULT '',
            exampleSentence TEXT NOT NULL DEFAULT '',
            sentenceTranslation TEXT NOT NULL DEFAULT '',
            createdAt INTEGER NOT NULL,
            deckName TEXT NOT NULL,
            modelName TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cards_word ON cards(word);
        CREATE INDEX IF NOT EXISTS idx_cards_definition ON cards(definition);
        CREATE INDEX IF NOT EXISTS idx_cards_sentence_trans ON cards(sentenceTranslation);

        CREATE TABLE IF NOT EXISTS word_cache (
            word TEXT NOT NULL,
            deck TEXT NOT NULL,
            PRIMARY KEY (word, deck)
        );

        CREATE TABLE IF NOT EXISTS usage_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inputTokens INTEGER NOT NULL,
            outputTokens INTEGER NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT '',
            cost REAL NOT NULL DEFAULT 0,
            createdAt INTEGER NOT NULL
        );
    """)

    # Migration: add nativeDefinition column to existing tables
    for table in ("cards", "pending"):
        try:
            db.execute(f"ALTER TABLE {table} ADD COLUMN nativeDefinition TEXT NOT NULL DEFAULT ''")
        except sqlite3.OperationalError as e:
            if "duplicate column" not in str(e):
                raise

    # Migration: rename banglaDefinition → nativeDefinition
    for table in ("cards", "pending"):
        cols = [row[1] for row in db.execute(f"PRAGMA table_info({table})").fetchall()]
        if "banglaDefinition" in cols and "nativeDefinition" not in cols:
            db.execute(f"ALTER TABLE {table} RENAME COLUMN banglaDefinition TO nativeDefinition")

    # Index on nativeDefinition (created after migration to handle renamed column)
    db.execute("CREATE INDEX IF NOT EXISTS idx_cards_native_def ON cards(nativeDefinition)")


def _rows_to_list(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


# --- Session state ---

def get_state() -> dict[str, Any]:
    db = _get_db()
    cards = db.execute("SELECT * FROM cards ORDER BY createdAt").fetchall()
    pending = db.execute("SELECT * FROM pending ORDER BY createdAt").fetchall()
    return {
        "cards": _rows_to_list(cards),
        "pendingQueue": _rows_to_list(pending),
    }


def add_card(card: dict[str, Any]) -> None:
    db = _get_db()
    db.execute(
        """INSERT OR REPLACE INTO cards
        (id, word, definition, nativeDefinition, exampleSentence, sentenceTranslation,
         createdAt, noteId, deckName, modelName)
        VALUES (:id, :word, :definition, :nativeDefinition, :exampleSentence,
                :sentenceTranslation, :createdAt, :noteId, :deckName, :modelName)""",
        card,
    )
    db.commit()


def remove_card(card_id: str) -> bool:
    db = _get_db()
    cursor = db.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    db.commit()
    return cursor.rowcount > 0


def add_pending(card: dict[str, Any]) -> None:
    db = _get_db()
    db.execute(
        """INSERT OR REPLACE INTO pending
        (id, word, definition, nativeDefinition, exampleSentence, sentenceTranslation,
         createdAt, deckName, modelName)
        VALUES (:id, :word, :definition, :nativeDefinition, :exampleSentence,
                :sentenceTranslation, :createdAt, :deckName, :modelName)""",
        card,
    )
    db.commit()


def remove_pending(card_id: str) -> bool:
    db = _get_db()
    cursor = db.execute("DELETE FROM pending WHERE id = ?", (card_id,))
    db.commit()
    return cursor.rowcount > 0


def promote_pending(pending_id: str, note_id: int) -> dict[str, Any] | None:
    db = _get_db()
    row = db.execute("SELECT * FROM pending WHERE id = ?", (pending_id,)).fetchone()
    if row is None:
        return None
    pending = dict(row)

    db.execute("DELETE FROM pending WHERE id = ?", (pending_id,))
    card = {
        "id": pending["id"],
        "createdAt": pending["createdAt"],
        "word": pending["word"],
        "definition": pending["definition"],
        "nativeDefinition": pending["nativeDefinition"],
        "exampleSentence": pending["exampleSentence"],
        "sentenceTranslation": pending["sentenceTranslation"],
        "deckName": pending["deckName"],
        "modelName": pending["modelName"],
        "noteId": note_id,
    }
    db.execute(
        """INSERT OR REPLACE INTO cards
        (id, word, definition, nativeDefinition, exampleSentence, sentenceTranslation,
         createdAt, noteId, deckName, modelName)
        VALUES (:id, :word, :definition, :nativeDefinition, :exampleSentence,
                :sentenceTranslation, :createdAt, :noteId, :deckName, :modelName)""",
        card,
    )
    db.commit()
    return card


def clear_all() -> None:
    db = _get_db()
    db.execute("DELETE FROM cards")
    db.execute("DELETE FROM pending")
    db.commit()


# --- Usage tracking ---

def record_usage(usage: dict[str, Any], cost: float) -> None:
    with _db_lock:
        db = _get_db()
        db.execute(
            """INSERT INTO usage_log (inputTokens, outputTokens, provider, model, cost, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (
                usage.get("inputTokens", 0),
                usage.get("outputTokens", 0),
                usage.get("provider", ""),
                usage.get("model", ""),
                cost,
                int(time.time() * 1000),
            ),
        )
        db.commit()


def get_usage_totals() -> dict[str, Any]:
    db = _get_db()
    row = db.execute(
        """SELECT COALESCE(SUM(inputTokens), 0) as totalInputTokens,
                  COALESCE(SUM(outputTokens), 0) as totalOutputTokens,
                  COALESCE(SUM(cost), 0) as totalCost,
                  COUNT(*) as requestCount
           FROM usage_log"""
    ).fetchone()
    return dict(row) if row else {
        "totalInputTokens": 0,
        "totalOutputTokens": 0,
        "totalCost": 0,
        "requestCount": 0,
    }


def clear_usage() -> None:
    db = _get_db()
    db.execute("DELETE FROM usage_log")
    db.commit()


# --- History search ---

def search_history(
    query: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    db = _get_db()
    if query and query.strip():
        pattern = f"%{query.strip()}%"
        where = (
            "WHERE word LIKE ? OR definition LIKE ? "
            "OR nativeDefinition LIKE ? OR sentenceTranslation LIKE ?"
        )
        params = [pattern] * 4
        total_row = db.execute(f"SELECT COUNT(*) as total FROM cards {where}", params).fetchone()
        total = total_row["total"] if total_row else 0
        items = db.execute(
            f"SELECT * FROM cards {where} ORDER BY createdAt DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()
    else:
        total_row = db.execute("SELECT COUNT(*) as total FROM cards").fetchone()
        total = total_row["total"] if total_row else 0
        items = db.execute(
            "SELECT * FROM cards ORDER BY createdAt DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()

    return {"items": _rows_to_list(items), "total": total}


# --- Word cache persistence ---

def load_word_cache() -> dict[str, set[str]]:
    db = _get_db()
    rows = db.execute("SELECT word, deck FROM word_cache").fetchall()
    cache: dict[str, set[str]] = {}
    for row in rows:
        deck = row["deck"]
        if deck not in cache:
            cache[deck] = set()
        cache[deck].add(row["word"])
    return cache


def add_word_to_db_cache(word: str, deck: str) -> None:
    db = _get_db()
    db.execute("INSERT OR IGNORE INTO word_cache (word, deck) VALUES (?, ?)", (word, deck))
    db.commit()


def replace_deck_cache(deck: str, words: set[str]) -> None:
    db = _get_db()
    db.execute("DELETE FROM word_cache WHERE deck = ?", (deck,))
    db.executemany(
        "INSERT OR IGNORE INTO word_cache (word, deck) VALUES (?, ?)",
        [(w, deck) for w in words],
    )
    db.commit()


def close() -> None:
    """Close the database connection."""
    global _db
    if _db is not None:
        _db.close()
        _db = None
