"""AnkiConnect HTTP client for standalone server.

Communicates with Anki Desktop via the AnkiConnect add-on API (localhost:8765).
Includes an SQLite-backed word cache for offline duplicate detection.
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from .session import add_word_to_db_cache, load_word_cache, replace_deck_cache
from .settings import get_settings

_client: httpx.Client | None = None
_client_url: str | None = None

# Word cache for offline duplicate detection (SQLite-backed)
_word_cache: dict[str, set[str]] = load_word_cache()
if _word_cache:
    for deck, words in _word_cache.items():
        print(f'[Anki] Loaded {len(words)} cached words for "{deck}" from disk')

_last_cache_refresh = 0
_CACHE_TTL_MS = 5 * 60 * 1000  # 5 minutes


def _get_client() -> tuple[httpx.Client, str]:
    global _client, _client_url
    settings = get_settings()
    url = settings.get("ankiConnectUrl", "http://localhost:8765")

    if _client is None or _client_url != url:
        if _client is not None:
            _client.close()
        _client = httpx.Client(timeout=10.0)
        _client_url = url
    return _client, url


def _invoke(action: str, **params: Any) -> Any:
    """Send a request to AnkiConnect and return the result."""
    client, url = _get_client()
    body: dict[str, Any] = {"action": action, "version": 6}
    if params:
        body["params"] = params
    resp = client.post(url, json=body)
    resp.raise_for_status()
    data = resp.json()
    if data.get("error"):
        raise RuntimeError(f"AnkiConnect error: {data['error']}")
    return data.get("result")


def _get_root_deck(deck_name: str) -> str:
    """Get the top-level deck name (e.g. 'Bangla::Foo::Bar' -> 'Bangla')."""
    sep = deck_name.find("::")
    return deck_name[:sep] if sep != -1 else deck_name


# --- Public API ---

def get_decks() -> list[str]:
    return _invoke("deckNames")


def get_models() -> list[str]:
    return _invoke("modelNames")


def get_model_fields(model_name: str) -> list[str]:
    return _invoke("modelFieldNames", modelName=model_name)


def search_notes(query: str) -> list[dict[str, Any]]:
    note_ids = _invoke("findNotes", query=query)
    if not note_ids:
        return []
    notes_info = _invoke("notesInfo", notes=note_ids)
    return [
        {
            "noteId": n["noteId"],
            "modelName": n["modelName"],
            "tags": n["tags"],
            "fields": n["fields"],
        }
        for n in notes_info
        if n is not None
    ]


def search_word(word: str, deck_name: str) -> dict[str, Any] | None:
    """Search for a word in the root deck across standard field names."""
    root_deck = _get_root_deck(deck_name)
    escaped_deck = root_deck.replace("\\", "\\\\").replace('"', '\\"')
    escaped_word = word.replace("\\", "\\\\").replace('"', '\\"')

    settings = get_settings()
    word_field = (settings.get("fieldMapping") or {}).get("Word")
    word_fields = {"Front", "Word"}
    if word_field:
        word_fields.add(word_field)

    field_queries = " OR ".join(f'{f}:"{escaped_word}"' for f in word_fields)
    query = f'deck:"{escaped_deck}" ({field_queries})'
    notes = search_notes(query)
    return notes[0] if notes else None


def get_note_by_id(note_id: int) -> dict[str, Any] | None:
    notes = _invoke("notesInfo", notes=[note_id])
    if not notes or notes[0] is None:
        return None
    n = notes[0]
    return {
        "noteId": n["noteId"],
        "modelName": n["modelName"],
        "tags": n["tags"],
        "fields": n["fields"],
    }


def create_card(
    deck: str,
    model: str,
    word: str,
    definition: str,
    bangla_definition: str,
    example_sentence: str,
    sentence_translation: str,
    tags: list[str] | None = None,
) -> int:
    """Create a new Anki note and return the note ID."""
    settings = get_settings()
    mapping = settings.get("fieldMapping") or {}

    fields = {
        mapping.get("Word", "Word"): word,
        mapping.get("Definition", "Definition"): definition,
        mapping.get("BanglaDefinition", "BanglaDefinition"): bangla_definition,
        mapping.get("Example", "Example"): example_sentence,
        mapping.get("Translation", "Translation"): sentence_translation,
    }

    print(f"[Anki] Creating card with model: {model}")
    print(f"[Anki] Field mapping: {mapping}")
    print(f"[Anki] Fields: {fields}")

    note_id = _invoke(
        "addNote",
        note={
            "deckName": deck,
            "modelName": model,
            "fields": fields,
            "tags": tags or ["auto-generated"],
        },
    )

    if note_id is None:
        raise RuntimeError("Failed to create note - duplicate or invalid")

    # Add to word cache
    if word:
        add_word_to_cache(word, deck)

    return note_id


def delete_note(note_id: int) -> None:
    _invoke("deleteNotes", notes=[note_id])


def sync() -> None:
    _invoke("sync")


def test_connection() -> bool:
    try:
        _invoke("version")
        # Refresh word cache on successful connection
        try:
            _refresh_word_cache()
        except Exception as e:
            print(f"[Anki] Word cache refresh failed: {e}")
        return True
    except Exception:
        return False


# --- Word cache ---

def _refresh_word_cache() -> None:
    global _last_cache_refresh
    now = int(time.time() * 1000)
    if now - _last_cache_refresh < _CACHE_TTL_MS:
        return
    _last_cache_refresh = now

    settings = get_settings()
    deck_name = settings.get("defaultDeck", "")
    if not deck_name:
        return

    root_deck = _get_root_deck(deck_name)
    escaped_deck = root_deck.replace("\\", "\\\\").replace('"', '\\"')

    note_ids = _invoke("findNotes", query=f'deck:"{escaped_deck}"')
    if not note_ids:
        _word_cache[root_deck] = set()
        replace_deck_cache(root_deck, set())
        return

    notes_info = _invoke("notesInfo", notes=note_ids)
    word_field = (settings.get("fieldMapping") or {}).get("Word", "Word")
    fallback_field = "Front"

    words: set[str] = set()
    for note in notes_info:
        if not note:
            continue
        value = (
            note.get("fields", {}).get(word_field, {}).get("value")
            or note.get("fields", {}).get(fallback_field, {}).get("value")
        )
        if value:
            words.add(value.lower())

    _word_cache[root_deck] = words
    replace_deck_cache(root_deck, words)
    print(f'[Anki] Word cache refreshed for "{root_deck}": {len(words)} words')


def search_word_cached(word: str, deck_name: str) -> dict[str, Any] | None:
    """Search for a word with fallback to in-memory cache when Anki is offline."""
    try:
        return search_word(word, deck_name)
    except Exception:
        cached = _word_cache.get(_get_root_deck(deck_name))
        if cached and word.lower() in cached:
            return {"noteId": 0, "modelName": "", "tags": [], "fields": {}}
        return None


def add_word_to_cache(word: str, deck_name: str) -> None:
    """Add a word to the cache after successful card creation."""
    root_deck = _get_root_deck(deck_name)
    lower = word.lower()
    if root_deck not in _word_cache:
        _word_cache[root_deck] = set()
    _word_cache[root_deck].add(lower)
    add_word_to_db_cache(lower, root_deck)
