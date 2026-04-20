"""AnkiConnect HTTP client for standalone server.

Communicates with Anki Desktop via the AnkiConnect add-on API (localhost:8765).
Includes an SQLite-backed word cache for offline duplicate detection, and
auto-creates per-language note types on demand via `ensure_language_models`.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from . import ai, note_types
from .note_types import CardType, build_card_fields, render_note_type
from .session import add_word_to_db_cache, load_word_cache, replace_deck_cache
from .settings import get_settings

log = logging.getLogger(__name__)

_client: httpx.Client | None = None
_client_url: str | None = None

# Word cache for offline duplicate detection (SQLite-backed)
_word_cache: dict[str, set[str]] = load_word_cache()
if _word_cache:
    for deck, words in _word_cache.items():
        log.info('Loaded %d cached words for "%s" from disk', len(words), deck)

_last_cache_refresh = 0
_CACHE_TTL_MS = 5 * 60 * 1000  # 5 minutes

# Cache of (note_type_prefix, language_code, card_type) -> model_name for
# models we have already verified exist in Anki this process lifetime.
_ensured_models: dict[tuple[str, str, str], str] = {}


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


def create_model(
    model_name: str,
    fields: list[str],
    css: str,
    is_cloze: bool,
    templates: list[dict[str, str]],
) -> None:
    """Create a new note type via AnkiConnect's ``createModel`` action.

    ``templates`` is a list of dicts with ``Name``/``Front``/``Back`` keys,
    matching the AnkiConnect API shape.
    """
    _invoke(
        "createModel",
        modelName=model_name,
        inOrderFields=fields,
        css=css,
        isCloze=is_cloze,
        cardTemplates=templates,
    )


def ensure_language_models(
    language: dict[str, Any],
    note_type_prefix: str,
    card_types: list[CardType] | None = None,
    anki_tts_locale_override: str | None = None,
) -> dict[str, str]:
    """Ensure note types exist in Anki for the given language.

    Returns a mapping ``{card_type: model_name}``. Idempotent: consults Anki
    once per process for missing models, caches results in
    ``_ensured_models``, and creates only what's missing.
    """
    wanted: tuple[CardType, ...] = tuple(card_types) if card_types else note_types.all_card_types()
    code = language["code"]

    result: dict[str, str] = {}
    missing: list[CardType] = []
    for ct in wanted:
        key = (note_type_prefix, code, ct)
        if key in _ensured_models:
            result[ct] = _ensured_models[key]
        else:
            missing.append(ct)

    if not missing:
        return result

    # Query Anki once for the full model list, then create whatever's absent.
    existing_models = set(_invoke("modelNames") or [])
    for ct in missing:
        rendered = render_note_type(ct, language, note_type_prefix, anki_tts_locale_override)
        model_name = rendered["modelName"]
        if model_name not in existing_models:
            log.info("Auto-creating Anki note type: %s", model_name)
            create_model(
                model_name=model_name,
                fields=rendered["fields"],
                css=rendered["css"],
                is_cloze=rendered["isCloze"],
                templates=rendered["templates"],
            )
        else:
            _migrate_existing_model(model_name, rendered)
        _ensured_models[(note_type_prefix, code, ct)] = model_name
        result[ct] = model_name

    return result


def check_pending_migrations(
    language: dict[str, Any],
    note_type_prefix: str,
    card_types: list[CardType] | None = None,
    anki_tts_locale_override: str | None = None,
) -> list[dict[str, Any]]:
    """Check for note types that need field additions (without modifying anything).

    Returns a list of ``{"modelName": ..., "newFields": [...]}`` dicts for
    models that exist but are missing fields.  Returns ``[]`` when nothing
    needs migrating (the common case).  Respects ``_ensured_models`` cache —
    if the model was already ensured this process, it won't appear here.
    """
    wanted = tuple(card_types) if card_types else note_types.all_card_types()
    code = language["code"]

    to_check: list[CardType] = []
    for ct in wanted:
        if (note_type_prefix, code, ct) not in _ensured_models:
            to_check.append(ct)

    if not to_check:
        return []

    existing_models = set(_invoke("modelNames") or [])
    pending: list[dict[str, Any]] = []

    for ct in to_check:
        rendered = render_note_type(ct, language, note_type_prefix, anki_tts_locale_override)
        model_name = rendered["modelName"]
        if model_name not in existing_models:
            continue  # New model — will be created, not migrated
        current = set(_invoke("modelFieldNames", modelName=model_name) or [])
        new_fields = [f for f in rendered["fields"] if f not in current]
        if new_fields:
            pending.append({"modelName": model_name, "newFields": new_fields})

    return pending


def check_migrations_for_deck(
    deck: str,
    card_types: list[CardType] | None = None,
) -> list[dict[str, Any]]:
    """Resolve deck language and check for pending note-type migrations."""
    from .settings import get_settings

    settings = get_settings()
    prefix = settings.get("noteTypePrefix", "anki-defs")
    language = ai.get_language_for_deck(deck)
    tts_overrides = settings.get("ankiTtsLocaleByLanguage") or {}
    tts_override = tts_overrides.get(language["code"])
    return check_pending_migrations(language, prefix, card_types, tts_override)


def check_template_versions(
    note_type_prefix: str,
) -> list[dict[str, Any]]:
    """Check all models matching the prefix for outdated templates or missing fields.

    Returns a list of issues — one per model that needs attention.
    """
    from .settings import get_settings

    settings = get_settings()
    tts_overrides = settings.get("ankiTtsLocaleByLanguage") or {}

    existing_models = _invoke("modelNames") or []
    prefix_with_dash = note_type_prefix + "-"
    matching = [m for m in existing_models if m.startswith(prefix_with_dash)]
    if not matching:
        return []

    issues: list[dict[str, Any]] = []
    for model_name in matching:
        # Determine card type from model name suffix
        remainder = model_name[len(prefix_with_dash):]
        card_type: CardType | None = None
        for ct in note_types.all_card_types():
            defn = note_types.get_note_type_definition(ct)
            suffix = defn.get("modelNameSuffix", "")
            if suffix and remainder.endswith(suffix):
                card_type = ct
                break
        if card_type is None:
            card_type = "vocab"  # no suffix = vocab

        # Resolve language code from model name
        defn = note_types.get_note_type_definition(card_type)
        suffix = defn.get("modelNameSuffix", "")
        lang_code = remainder[: -len(suffix)] if suffix else remainder
        language = ai.get_language_by_code(lang_code)
        if language is None:
            continue

        tts_override = tts_overrides.get(lang_code)
        rendered = note_types.render_note_type(
            card_type, language, note_type_prefix, tts_override
        )

        # Check fields
        current_fields = set(_invoke("modelFieldNames", modelName=model_name) or [])
        missing_fields = [f for f in rendered["fields"] if f not in current_fields]

        # Check template versions
        live_templates = _invoke("modelTemplates", modelName=model_name) or {}
        stale_templates: list[dict[str, Any]] = []
        latest_version = rendered.get("version", 0)

        for tmpl in rendered["templates"]:
            tmpl_name = tmpl["Name"]
            live = live_templates.get(tmpl_name, {})
            live_front = live.get("Front", "")
            live_back = live.get("Back", "")

            front_ver = note_types.extract_template_version(live_front)
            back_ver = note_types.extract_template_version(live_back)
            current_ver = min(
                v for v in (front_ver, back_ver) if v is not None
            ) if front_ver is not None or back_ver is not None else None

            if current_ver is None or current_ver < latest_version:
                stale_templates.append({
                    "name": tmpl_name,
                    "currentVersion": current_ver,
                    "current": {"front": live_front, "back": live_back},
                    "proposed": {"front": tmpl["Front"], "back": tmpl["Back"]},
                })

        # Check CSS
        live_css = (_invoke("modelStyling", modelName=model_name) or {}).get("css", "")
        css_outdated = live_css.strip() != rendered["css"].strip()

        if missing_fields or stale_templates or css_outdated:
            issue: dict[str, Any] = {
                "modelName": model_name,
                "cardType": card_type,
                "latestVersion": latest_version,
                "missingFields": missing_fields,
                "staleTemplates": stale_templates,
                "cssOutdated": css_outdated,
            }
            if css_outdated:
                issue["currentCss"] = live_css
                issue["proposedCss"] = rendered["css"]
            issues.append(issue)

    return issues


def update_model_templates(
    model_name: str,
    note_type_prefix: str,
    template_overrides: dict[str, dict[str, str]] | None = None,
    css_override: str | None = None,
) -> dict[str, Any]:
    """Update a model's templates and CSS.

    When ``template_overrides`` is provided, uses the user-edited content
    instead of the rendered defaults. Format: ``{templateName: {front, back}}``.
    Also adds any missing fields.
    """
    from .settings import get_settings

    settings = get_settings()
    tts_overrides = settings.get("ankiTtsLocaleByLanguage") or {}

    prefix_with_dash = note_type_prefix + "-"
    remainder = model_name[len(prefix_with_dash):]

    card_type: CardType = "vocab"
    for ct in note_types.all_card_types():
        defn = note_types.get_note_type_definition(ct)
        suffix = defn.get("modelNameSuffix", "")
        if suffix and remainder.endswith(suffix):
            card_type = ct
            break

    defn = note_types.get_note_type_definition(card_type)
    suffix = defn.get("modelNameSuffix", "")
    lang_code = remainder[: -len(suffix)] if suffix else remainder
    language = ai.get_language_by_code(lang_code)
    if language is None:
        raise ValueError(f"Unknown language code: {lang_code}")

    tts_override = tts_overrides.get(lang_code)
    rendered = note_types.render_note_type(
        card_type, language, note_type_prefix, tts_override
    )

    # Add missing fields
    _migrate_existing_model(model_name, rendered)

    # Build templates — use overrides when provided
    templates_payload: dict[str, dict[str, str]] = {}
    for t in rendered["templates"]:
        name = t["Name"]
        if template_overrides and name in template_overrides:
            override = template_overrides[name]
            templates_payload[name] = {
                "Front": override["front"] if "front" in override else t["Front"],
                "Back": override["back"] if "back" in override else t["Back"],
            }
        else:
            templates_payload[name] = {"Front": t["Front"], "Back": t["Back"]}

    log.info("Updating templates on model %s to v%s", model_name, rendered.get("version"))
    _invoke("updateModelTemplates", model={"name": model_name, "templates": templates_payload})

    # Update CSS
    final_css = css_override if css_override is not None else rendered["css"]
    log.info("Updating CSS on model %s", model_name)
    _invoke("updateModelStyling", model={"name": model_name, "css": final_css})

    return {
        "modelName": model_name,
        "version": rendered.get("version", 0),
        "updated": True,
    }


def _migrate_existing_model(model_name: str, rendered: dict[str, Any]) -> None:
    """Ensure an existing model has all required fields.

    Only adds missing fields — never touches templates or CSS. Modifying
    templates would destroy user customizations and trigger a forced one-way
    sync in Anki (schema modification bumps scm).
    """
    current = _invoke("modelFieldNames", modelName=model_name) or []
    current_set = set(current)
    for name in rendered["fields"]:
        if name not in current_set:
            log.info("Adding field %s to existing model %s", name, model_name)
            _invoke("modelFieldAdd", modelName=model_name, fieldName=name, index=len(current))
            current.append(name)
            current_set.add(name)


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
    """Search for a word in the root deck across standard field names.

    Falls back to an in-memory/SQLite word cache when AnkiConnect is
    unreachable, returning a stub note so duplicate detection still works
    offline.
    """
    root_deck = _get_root_deck(deck_name)
    try:
        escaped_deck = root_deck.replace("\\", "\\\\").replace('"', '\\"')
        escaped_word = word.replace("\\", "\\\\").replace('"', '\\"')

        word_fields = ("Front", "Word")
        field_queries = " OR ".join(
            f'{f}:"{escaped_word}"' for f in word_fields
        )
        query = f'deck:"{escaped_deck}" ({field_queries})'
        notes = search_notes(query)
        return notes[0] if notes else None
    except (httpx.HTTPError, RuntimeError):
        cached = _word_cache.get(root_deck)
        if cached and word.lower() in cached:
            return {"noteId": 0, "modelName": "", "tags": [], "fields": {}}
        return None


def get_note(note_id: int) -> dict[str, Any] | None:
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
    card_type: CardType,
    word: str,
    definition: str,
    native_definition: str,
    example: str,
    translation: str,
    vocab_templates: dict[str, bool] | None = None,
    tags: list[str] | None = None,
) -> tuple[int, str]:
    """Create a new Anki note from a domain payload.

    The server resolves the deck's language, ensures the right note type
    exists in Anki (auto-creating it on first use), builds the field map,
    and finally calls ``addNote``. The client never deals with model names.

    Returns ``(note_id, model_name)`` so callers can record which note type
    was used (for session card display, history, etc.).
    """
    settings = get_settings()
    note_type_prefix = settings.get("noteTypePrefix", "anki-defs")

    language = ai.get_language_for_deck(deck)
    tts_overrides = settings.get("ankiTtsLocaleByLanguage") or {}
    tts_override = tts_overrides.get(language["code"])
    models = ensure_language_models(language, note_type_prefix, [card_type], tts_override)
    model_name = models[card_type]

    # Fall back to the global vocabCardTemplates default when the caller
    # didn't override per-note.
    if card_type == "vocab" and vocab_templates is None:
        vocab_templates = settings.get("vocabCardTemplates") or {}

    fields = build_card_fields(
        card_type,
        word=word,
        definition=definition,
        native_definition=native_definition,
        example=example,
        translation=translation,
        vocab_templates=vocab_templates,
    )

    log.info("Creating %s card with model: %s", card_type, model_name)
    log.debug("Fields: %s", fields)

    note_id = _invoke(
        "addNote",
        note={
            "deckName": deck,
            "modelName": model_name,
            "fields": fields,
            "tags": tags or ["auto-generated"],
            "options": {"allowDuplicate": True},
        },
    )

    if note_id is None:
        raise RuntimeError(
            f"Cannot create note. The first field of note type '{model_name}' may be empty."
        )

    # Add to word cache
    if word:
        add_word_to_cache(word, deck)

    return note_id, model_name


def delete_note(note_id: int) -> None:
    _invoke("deleteNotes", notes=[note_id])


def sync() -> None:
    _invoke("sync")


def get_status() -> dict[str, bool]:
    """Check whether AnkiConnect is reachable."""
    return {"connected": test_connection()}


def test_connection() -> bool:
    try:
        _invoke("version")
        # Refresh word cache on successful connection
        try:
            _refresh_word_cache()
        except (httpx.HTTPError, RuntimeError) as e:
            log.warning("Word cache refresh failed: %s", e)
        return True
    except (httpx.HTTPError, RuntimeError):
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

    words: set[str] = set()
    for note in notes_info:
        if not note:
            continue
        # auto-generated vocab notes use "Word"; legacy/user notes may use "Front".
        value = (
            note.get("fields", {}).get("Word", {}).get("value")
            or note.get("fields", {}).get("Front", {}).get("value")
        )
        if value:
            words.add(value.lower())

    _word_cache[root_deck] = words
    replace_deck_cache(root_deck, words)
    log.info('Word cache refreshed for "%s": %d words', root_deck, len(words))



def add_word_to_cache(word: str, deck_name: str) -> None:
    """Add a word to the cache after successful card creation."""
    root_deck = _get_root_deck(deck_name)
    lower = word.lower()
    if root_deck not in _word_cache:
        _word_cache[root_deck] = set()
    _word_cache[root_deck].add(lower)
    add_word_to_db_cache(lower, root_deck)


def reset_ensured_models_cache() -> None:
    """Drop the ensured-models cache (used by tests)."""
    _ensured_models.clear()
