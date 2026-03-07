"""Session persistence using SQLite in the add-on's user_files directory."""

import os
import sqlite3

_DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "user_files")
_DB_PATH = os.path.join(_DB_DIR, "session.db")

# Ensure directory exists
os.makedirs(_DB_DIR, exist_ok=True)

_db = None


def _get_db():
    global _db
    if _db is None:
        _db = sqlite3.connect(_DB_PATH)
        _db.row_factory = sqlite3.Row
        _db.execute("PRAGMA journal_mode = WAL")
        _db.execute("PRAGMA foreign_keys = ON")
        _db.executescript("""
            CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY,
                word TEXT NOT NULL,
                definition TEXT NOT NULL,
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
                exampleSentence TEXT NOT NULL DEFAULT '',
                sentenceTranslation TEXT NOT NULL DEFAULT '',
                createdAt INTEGER NOT NULL,
                deckName TEXT NOT NULL,
                modelName TEXT NOT NULL
            );
        """)
    return _db


def _row_to_dict(row):
    if row is None:
        return None
    return dict(row)


def get_state():
    db = _get_db()
    cards = [
        _row_to_dict(r) for r in db.execute("SELECT * FROM cards ORDER BY createdAt").fetchall()
    ]
    pending = [
        _row_to_dict(r) for r in db.execute("SELECT * FROM pending ORDER BY createdAt").fetchall()
    ]
    return {"cards": cards, "pendingQueue": pending}


def add_card(card):
    db = _get_db()
    db.execute(
        "INSERT OR REPLACE INTO cards (id, word, definition, exampleSentence, sentenceTranslation, createdAt, noteId, deckName, modelName) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            card["id"],
            card["word"],
            card["definition"],
            card.get("exampleSentence", ""),
            card.get("sentenceTranslation", ""),
            card["createdAt"],
            card["noteId"],
            card["deckName"],
            card["modelName"],
        ),
    )
    db.commit()


def remove_card(card_id):
    db = _get_db()
    cursor = db.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    db.commit()
    return cursor.rowcount > 0


def add_pending(card):
    db = _get_db()
    db.execute(
        "INSERT OR REPLACE INTO pending (id, word, definition, exampleSentence, sentenceTranslation, createdAt, deckName, modelName) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            card["id"],
            card["word"],
            card["definition"],
            card.get("exampleSentence", ""),
            card.get("sentenceTranslation", ""),
            card["createdAt"],
            card["deckName"],
            card["modelName"],
        ),
    )
    db.commit()


def remove_pending(card_id):
    db = _get_db()
    cursor = db.execute("DELETE FROM pending WHERE id = ?", (card_id,))
    db.commit()
    return cursor.rowcount > 0


def promote_pending(pending_id, note_id):
    db = _get_db()
    row = db.execute("SELECT * FROM pending WHERE id = ?", (pending_id,)).fetchone()
    if not row:
        return None
    pending = _row_to_dict(row)
    db.execute("DELETE FROM pending WHERE id = ?", (pending_id,))
    card = {
        "id": pending["id"],
        "word": pending["word"],
        "definition": pending["definition"],
        "exampleSentence": pending["exampleSentence"],
        "sentenceTranslation": pending["sentenceTranslation"],
        "createdAt": pending["createdAt"],
        "deckName": pending["deckName"],
        "modelName": pending["modelName"],
        "noteId": note_id,
    }
    db.execute(
        "INSERT OR REPLACE INTO cards (id, word, definition, exampleSentence, sentenceTranslation, createdAt, noteId, deckName, modelName) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            card["id"],
            card["word"],
            card["definition"],
            card["exampleSentence"],
            card["sentenceTranslation"],
            card["createdAt"],
            card["noteId"],
            card["deckName"],
            card["modelName"],
        ),
    )
    db.commit()
    return card


def clear_all():
    db = _get_db()
    db.execute("DELETE FROM cards")
    db.execute("DELETE FROM pending")
    db.commit()
