"""Anki collection operations -- direct access via mw.col.

All public functions use @main_thread to safely access the collection
from any thread (Bottle's request threads, daemon threads, etc.).
"""

import logging

from anki_defs._services import note_types as _note_types
from anki_defs._services.ai import get_language_by_code as _get_language_by_code
from anki_defs._services.ai import get_language_for_deck as _get_language_for_deck
from anki_defs._services.note_types import (
    build_card_fields as _build_card_fields,
)
from anki_defs._services.note_types import (
    extract_template_version as _extract_template_version,
)
from anki_defs._services.note_types import (
    render_note_type as _render_note_type,
)
from anki_defs.server.bridge import main_thread
from aqt import mw

log = logging.getLogger(__name__)

# Cache of (note_type_prefix, language_code, card_type) -> model_name for
# models we have already verified/created this process lifetime.
_ensured_models = {}


@main_thread
def get_decks():
    """List all deck names."""
    col = _col()
    deck_list = col.decks.all_names_and_ids()
    return [d.name for d in deck_list]


@main_thread
def get_models():
    """List all note type names."""
    col = _col()
    model_list = col.models.all_names_and_ids()
    return [m.name for m in model_list]


@main_thread
def get_model_fields(model_name):
    """Get ordered field names for a note type."""
    col = _col()
    model = col.models.by_name(model_name)
    if not model:
        raise ValueError("Model not found: {}".format(model_name))
    field_map = col.models.field_map(model)
    return sorted(field_map.keys(), key=lambda f: field_map[f][0])


@main_thread
def search_notes(query):
    """Search notes by Anki query string."""
    col = _col()
    note_ids = col.find_notes(query)
    results = []
    for nid in note_ids:
        note = col.get_note(nid)
        results.append(_note_to_dict(col, note))
    return results


@main_thread
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


@main_thread
def search_words(words, deck_name):
    """Search for multiple words, returning a dict of word -> note_dict."""
    results = {}
    for word in words:
        note = search_word(word, deck_name)
        if note:
            results[word] = note
    return results


@main_thread
def get_note(note_id):
    """Get a note by ID."""
    col = _col()
    try:
        note = col.get_note(note_id)
    except (ValueError, KeyError):
        return None
    return _note_to_dict(col, note)


@main_thread
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


@main_thread
def ensure_language_models(language, note_type_prefix, card_types=None, anki_tts_locale_override=None):
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
        rendered = _render_note_type(ct, language, note_type_prefix, anki_tts_locale_override)
        model_name = rendered["modelName"]
        existing = col.models.by_name(model_name)
        if existing is None:
            create_model(
                model_name,
                rendered["fields"],
                rendered["css"],
                rendered["isCloze"],
                rendered["templates"],
            )
        else:
            _migrate_existing_model(existing, rendered)
        _ensured_models[(note_type_prefix, code, ct)] = model_name
        result[ct] = model_name
    return result


@main_thread
def check_pending_migrations(language, note_type_prefix, card_types=None, anki_tts_locale_override=None):
    """Check for note types that need field additions (without modifying anything).

    Returns a list of {"modelName": ..., "newFields": [...]} dicts for models
    that exist but are missing fields.  Returns [] when nothing needs migrating.
    Respects _ensured_models cache.
    """
    wanted = tuple(card_types) if card_types else _note_types.all_card_types()
    code = language["code"]

    to_check = []
    for ct in wanted:
        if (note_type_prefix, code, ct) not in _ensured_models:
            to_check.append(ct)

    if not to_check:
        return []

    col = _col()
    pending = []

    for ct in to_check:
        rendered = _render_note_type(ct, language, note_type_prefix, anki_tts_locale_override)
        model_name = rendered["modelName"]
        existing = col.models.by_name(model_name)
        if existing is None:
            continue  # New model — will be created, not migrated
        existing_names = {f["name"] for f in existing["flds"]}
        new_fields = [f for f in rendered["fields"] if f not in existing_names]
        if new_fields:
            pending.append({"modelName": model_name, "newFields": new_fields})

    return pending


def check_migrations_for_deck(deck, card_types=None):
    """Convenience wrapper: resolve deck language and check for pending migrations."""
    from .settings_service import get_settings

    settings = get_settings()
    prefix = settings.get("noteTypePrefix", "anki-defs")
    language = _get_language_for_deck(deck)
    tts_overrides = settings.get("ankiTtsLocaleByLanguage") or {}
    tts_override = tts_overrides.get(language["code"])
    return check_pending_migrations(language, prefix, card_types, tts_override)


def _migrate_existing_model(model, rendered):
    """Ensure an existing model has all required fields.

    Only adds missing fields — never touches templates or CSS. Modifying
    templates would destroy user customizations and trigger a forced one-way
    sync in Anki (schema modification bumps scm).
    """
    col = _col()
    added_fields = False
    existing_names = {f["name"] for f in model["flds"]}
    for name in rendered["fields"]:
        if name not in existing_names:
            log.info("Adding field %s to existing model %s", name, model["name"])
            field = col.models.new_field(name)
            col.models.add_field(model, field)
            added_fields = True
    if added_fields:
        col.models.update_dict(model)



@main_thread
def check_template_versions(note_type_prefix):
    """Check all models matching the prefix for outdated templates or missing fields.

    Returns a list of issues -- one per model that needs attention.
    """
    from .settings_service import get_settings

    settings = get_settings()
    tts_overrides = settings.get("ankiTtsLocaleByLanguage") or {}

    col = _col()
    model_list = col.models.all_names_and_ids()
    prefix_with_dash = note_type_prefix + "-"
    matching = [m.name for m in model_list if m.name.startswith(prefix_with_dash)]
    if not matching:
        return []

    issues = []
    for model_name in matching:
        remainder = model_name[len(prefix_with_dash):]

        # Determine card type from model name suffix
        card_type = None
        for ct in _note_types.all_card_types():
            defn = _note_types.get_note_type_definition(ct)
            suffix = defn.get("modelNameSuffix", "")
            if suffix and remainder.endswith(suffix):
                card_type = ct
                break
        if card_type is None:
            card_type = "vocab"  # no suffix = vocab

        # Resolve language code from model name
        defn = _note_types.get_note_type_definition(card_type)
        suffix = defn.get("modelNameSuffix", "")
        lang_code = remainder[: -len(suffix)] if suffix else remainder
        language = _get_language_by_code(lang_code)
        if language is None:
            continue

        tts_override = tts_overrides.get(lang_code)
        rendered = _render_note_type(
            card_type, language, note_type_prefix, tts_override
        )

        # Check fields
        model = col.models.by_name(model_name)
        if model is None:
            continue
        existing_fields = {f["name"] for f in model["flds"]}
        missing_fields = [f for f in rendered["fields"] if f not in existing_fields]

        # Check template versions
        stale_templates = []
        latest_version = rendered.get("version", 0)

        live_tmpls_by_name = {t["name"]: t for t in model["tmpls"]}
        for tmpl in rendered["templates"]:
            tmpl_name = tmpl["Name"]
            live = live_tmpls_by_name.get(tmpl_name)
            live_front = live["qfmt"] if live else ""
            live_back = live["afmt"] if live else ""
            if live is None:
                stale_templates.append({
                    "name": tmpl_name,
                    "currentVersion": None,
                    "current": {"front": "", "back": ""},
                    "proposed": {"front": tmpl["Front"], "back": tmpl["Back"]},
                })
                continue

            front_ver = _extract_template_version(live_front)
            back_ver = _extract_template_version(live_back)
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
        live_css = model.get("css", "")
        css_outdated = live_css.strip() != rendered["css"].strip()

        if missing_fields or stale_templates or css_outdated:
            issue = {
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


@main_thread
def update_model_templates(model_name, note_type_prefix, template_overrides=None, css_override=None):
    """Update a model's templates and CSS.

    When ``template_overrides`` is provided, uses user-edited content
    instead of rendered defaults. Format: ``{templateName: {front, back}}``.
    """
    from .settings_service import get_settings

    settings = get_settings()
    tts_overrides = settings.get("ankiTtsLocaleByLanguage") or {}

    prefix_with_dash = note_type_prefix + "-"
    remainder = model_name[len(prefix_with_dash):]

    card_type = "vocab"
    for ct in _note_types.all_card_types():
        defn = _note_types.get_note_type_definition(ct)
        suffix = defn.get("modelNameSuffix", "")
        if suffix and remainder.endswith(suffix):
            card_type = ct
            break

    defn = _note_types.get_note_type_definition(card_type)
    suffix = defn.get("modelNameSuffix", "")
    lang_code = remainder[: -len(suffix)] if suffix else remainder
    language = _get_language_by_code(lang_code)
    if language is None:
        raise ValueError("Unknown language code: {}".format(lang_code))

    tts_override = tts_overrides.get(lang_code)
    rendered = _render_note_type(
        card_type, language, note_type_prefix, tts_override
    )

    col = _col()
    model = col.models.by_name(model_name)
    if model is None:
        raise ValueError("Model not found: {}".format(model_name))

    # Add missing fields
    _migrate_existing_model(model, rendered)

    # Update templates — use overrides when provided
    live_tmpls_by_name = {t["name"]: t for t in model["tmpls"]}
    for tmpl in rendered["templates"]:
        name = tmpl["Name"]
        live = live_tmpls_by_name.get(name)
        if live is not None:
            if template_overrides and name in template_overrides:
                override = template_overrides[name]
                live["qfmt"] = override.get("front", tmpl["Front"])
                live["afmt"] = override.get("back", tmpl["Back"])
            else:
                live["qfmt"] = tmpl["Front"]
                live["afmt"] = tmpl["Back"]

    # Update CSS
    model["css"] = css_override if css_override is not None else rendered["css"]

    log.info("Updating templates on model %s to v%s", model_name, rendered.get("version"))
    col.models.update_dict(model)

    return {
        "modelName": model_name,
        "version": rendered.get("version", 0),
        "updated": True,
    }


@main_thread
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
    tts_overrides = settings.get("ankiTtsLocaleByLanguage") or {}
    tts_override = tts_overrides.get(language["code"])
    models = ensure_language_models(language, note_type_prefix, [card_type], tts_override)
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


@main_thread
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


@main_thread
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


@main_thread
def sync():
    """Trigger Anki sync."""
    mw.on_sync_button_clicked()


@main_thread
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
