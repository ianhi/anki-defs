"""Anki collection operations -- direct access via mw.col.

All functions in this module run on the main thread (called from QTimer poll),
so collection access is safe without any threading bridge.
"""

from aqt import mw


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


def search_word(word, deck_name, field_mapping=None):
    """Search for a word in specific fields within a deck."""
    col = _col()
    escaped_deck = deck_name.replace('"', '\\"')
    escaped_word = word.replace('"', '\\"')

    word_fields = {"Front", "Word"}
    if field_mapping and field_mapping.get("Word"):
        word_fields.add(field_mapping["Word"])

    field_queries = " OR ".join(
        '{}:"{}"'.format(f, escaped_word) for f in word_fields
    )
    query = 'deck:"{}" ({})'.format(escaped_deck, field_queries)

    note_ids = col.find_notes(query)
    if not note_ids:
        return None
    note = col.get_note(note_ids[0])
    return _note_to_dict(col, note)


def search_words(words, deck_name, field_mapping=None):
    """Search for multiple words, returning a dict of word -> note_dict."""
    results = {}
    for word in words:
        note = search_word(word, deck_name, field_mapping)
        if note:
            results[word] = note
    return results


def get_note(note_id):
    """Get a note by ID."""
    col = _col()
    try:
        note = col.get_note(note_id)
    except Exception:
        return None
    return _note_to_dict(col, note)


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

    if note.fields_check() == 2:  # empty first field
        raise ValueError("First field is empty")

    col.add_note(note, deck["id"])
    return note.id


def delete_note(note_id):
    """Delete a note by ID."""
    col = _col()
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
