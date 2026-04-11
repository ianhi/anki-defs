"""Anki collection operations -- direct access via mw.col.

All functions in this module run on the main thread (called from QTimer poll),
so collection access is safe without any threading bridge.
"""

from anki_defs._services import note_types as _note_types
from anki_defs._services.ai import get_language_for_deck as _get_language_for_deck
from anki_defs._services.note_types import (
    build_card_fields as _build_card_fields,
)
from anki_defs._services.note_types import (
    render_note_type as _render_note_type,
)
from aqt import mw

# Cache of (note_type_prefix, language_code, card_type) -> model_name for
# models we have already verified/created this process lifetime.
_ensured_models = {}


def get_decks():
    """List all deck names."""
    col = _col()
    deck_list = col.decks.all_names_and_ids()
    return [d.name for d in deck_list]


def get_models():
    """List all note type names."""
    col = _col()
    model_list = col.models.all_names_and_ids()
    return [m.name for m in model_list]


def get_model_fields(model_name):
    """Get ordered field names for a note type."""
    col = _col()
    model = col.models.by_name(model_name)
    if not model:
        raise ValueError("Model not found: {}".format(model_name))
    field_map = col.models.field_map(model)
    return sorted(field_map.keys(), key=lambda f: field_map[f][0])


def search_notes(query):
    """Search notes by Anki query string."""
    col = _col()
    note_ids = col.find_notes(query)
    results = []
    for nid in note_ids:
        note = col.get_note(nid)
        results.append(_note_to_dict(col, note))
    return results


def search_word(word, deck_name):
    """Search for a word in the standard Word/Front fields within a deck."""
    col = _col()
    escaped_deck = deck_name.replace("\\", "\\\\").replace('"', '\\"')
    escaped_word = word.replace("\\", "\\\\").replace('"', '\\"')

    # Auto-created note types always name the headword field "Word". Probe
    # "Front" too so duplicate detection keeps working on legacy/user notes.
    word_fields = ("Front", "Word")
    field_queries = " OR ".join('{}:"{}"'.format(f, escaped_word) for f in word_fields)
    query = 'deck:"{}" ({})'.format(escaped_deck, field_queries)

    note_ids = col.find_notes(query)
    if not note_ids:
        return None
    note = col.get_note(note_ids[0])
    return _note_to_dict(col, note)


def search_words(words, deck_name):
    """Search for multiple words, returning a dict of word -> note_dict."""
    results = {}
    for word in words:
        note = search_word(word, deck_name)
        if note:
            results[word] = note
    return results


def get_note(note_id):
    """Get a note by ID."""
    col = _col()
    try:
        note = col.get_note(note_id)
    except (ValueError, KeyError):
        return None
    return _note_to_dict(col, note)


def create_model(model_name, fields, css, is_cloze, templates):
    """Create a new note type in the Anki collection.

    ``templates`` is a list of dicts with ``Name``/``Front``/``Back`` keys
    (mirroring the AnkiConnect createModel shape used on the standalone
    server side, so both backends share the same contract).
    """
    col = _col()
    model = col.models.new(model_name)
    if is_cloze:
        # Anki's MODEL_CLOZE constant is 1.
        model["type"] = 1
    for field_name in fields:
        field = col.models.new_field(field_name)
        col.models.add_field(model, field)
    model["css"] = css
    for tmpl in templates:
        template = col.models.new_template(tmpl["Name"])
        template["qfmt"] = tmpl["Front"]
        template["afmt"] = tmpl["Back"]
        col.models.add_template(model, template)
    col.models.add(model)
    return model


def ensure_language_models(language, note_type_prefix, card_types=None):
    """Ensure note types exist in the Anki collection for the given language.

    Returns a dict mapping card_type -> model name. Idempotent: checks the
    collection once per language/card_type, then caches for subsequent calls.
    """
    wanted = tuple(card_types) if card_types else _note_types.all_card_types()
    code = language["code"]

    result = {}
    missing = []
    for ct in wanted:
        key = (note_type_prefix, code, ct)
        if key in _ensured_models:
            result[ct] = _ensured_models[key]
        else:
            missing.append(ct)

    if not missing:
        return result

    col = _col()
    for ct in missing:
        rendered = _render_note_type(ct, language, note_type_prefix)
        model_name = rendered["modelName"]
        if col.models.by_name(model_name) is None:
            create_model(
                model_name,
                rendered["fields"],
                rendered["css"],
                rendered["isCloze"],
                rendered["templates"],
            )
        _ensured_models[(note_type_prefix, code, ct)] = model_name
        result[ct] = model_name
    return result


def create_card(
    deck,
    card_type,
    word,
    definition,
    native_definition,
    example,
    translation,
    vocab_templates=None,
    tags=None,
):
    """Domain-payload wrapper around create_note.

    Resolves the deck's language, ensures the matching auto-created note
    type exists, builds the field map, then hands off to ``create_note``.
    """
    # Local import to avoid a circular import during addon startup.
    from .settings_service import get_settings

    settings = get_settings()
    note_type_prefix = settings.get("noteTypePrefix", "anki-defs")
    language = _get_language_for_deck(deck)
    models = ensure_language_models(language, note_type_prefix, [card_type])
    model_name = models[card_type]

    if card_type == "vocab" and vocab_templates is None:
        vocab_templates = settings.get("vocabCardTemplates") or {}

    fields = _build_card_fields(
        card_type,
        word=word,
        definition=definition,
        native_definition=native_definition,
        example=example,
        translation=translation,
        vocab_templates=vocab_templates,
    )
    note_id = create_note(deck, model_name, fields, tags)
    return note_id, model_name


def reset_ensured_models_cache():
    """Drop the ensured-models cache (used by tests)."""
    _ensured_models.clear()


def create_note(deck_name, model_name, fields, tags=None):
    """Create a new note. fields is a dict of {field_name: value}."""
    col = _col()
    model = col.models.by_name(model_name)
    if not model:
        raise ValueError("Model not found: {}".format(model_name))

    deck = col.decks.by_name(deck_name)
    if not deck:
        raise ValueError("Deck not found: {}".format(deck_name))

    note = col.new_note(model)

    field_map = col.models.field_map(model)
    for field_name, value in fields.items():
        if field_name in field_map:
            ord_idx = field_map[field_name][0]
            note.fields[ord_idx] = value

    if tags:
        note.tags = tags
    else:
        note.tags = ["auto-generated"]

    check = note.fields_check()
    if check == 2:  # empty first field
        raise ValueError("First field is empty")
    # check == 1 means duplicate — we allow duplicates (user already confirmed)

    col.add_note(note, deck["id"])
    return note.id


def delete_note(note_id):
    """Delete a note by ID. Only deletes notes with the 'auto-generated' tag."""
    col = _col()
    try:
        note = col.get_note(note_id)
    except (ValueError, KeyError):
        raise ValueError("Note not found: {}".format(note_id))
    if "auto-generated" not in note.tags:
        raise ValueError("Cannot delete note without 'auto-generated' tag")
    col.remove_notes([note_id])


def sync():
    """Trigger Anki sync."""
    mw.on_sync_button_clicked()


def get_status():
    """Check if collection is available."""
    return {"connected": mw.col is not None}


def _col():
    """Get the collection, raising if not available."""
    if mw.col is None:
        raise RuntimeError("Anki collection not available")
    return mw.col


def _note_to_dict(col, note):
    """Convert an Anki note to a dict matching the API contract."""
    nt = note.note_type()
    field_map = col.models.field_map(nt)
    fields = {}
    for name, (ord_idx, _) in field_map.items():
        fields[name] = {"value": note.fields[ord_idx], "order": ord_idx}
    return {
        "noteId": note.id,
        "modelName": nt["name"],
        "tags": list(note.tags),
        "fields": fields,
    }
