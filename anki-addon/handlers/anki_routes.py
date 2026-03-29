"""Anki collection API handlers."""

import json
from urllib.parse import unquote

from ..server.web import Response
from ..services import anki_service
from ..services.settings_service import get_settings


def handle_get_decks(_params, _headers, _body):
    try:
        decks = anki_service.get_decks()
        return Response.json({"decks": decks})
    except RuntimeError as e:
        return Response.error(str(e))


def handle_get_models(_params, _headers, _body):
    try:
        models = anki_service.get_models()
        return Response.json({"models": models})
    except RuntimeError as e:
        return Response.error(str(e))


def handle_get_model_fields(params, _headers, _body):
    try:
        name = unquote(params.get("name", ""))
        fields = anki_service.get_model_fields(name)
        return Response.json({"fields": fields})
    except ValueError as e:
        return Response.error(str(e), 400)
    except RuntimeError as e:
        return Response.error(str(e))


def handle_search(_params, _headers, body):
    try:
        data = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return Response.error("Invalid JSON", 400)
    query = data.get("query", "")
    if not query:
        return Response.error("Query is required", 400)
    try:
        notes = anki_service.search_notes(query)
        return Response.json({"notes": notes})
    except RuntimeError as e:
        return Response.error(str(e))


def handle_create_note(_params, _headers, body):
    try:
        data = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return Response.error("Invalid JSON", 400)
    deck_name = data.get("deckName", "")
    model_name = data.get("modelName", "")
    fields = data.get("fields", {})
    tags = data.get("tags")

    if not deck_name or not model_name or not fields:
        return Response.error("deckName, modelName, and fields are required", 400)

    # Apply field mapping (same logic as Express server)
    settings = get_settings()
    mapping = settings.get("fieldMapping", {})

    mapped_fields = {}
    if fields.get("Word"):
        mapped_fields[mapping.get("Word", "Word")] = fields["Word"]
    if fields.get("Definition"):
        mapped_fields[mapping.get("Definition", "Definition")] = fields["Definition"]
    if fields.get("NativeDefinition"):
        mapped_fields[mapping.get("NativeDefinition", "NativeDefinition")] = fields[
            "NativeDefinition"
        ]
    if fields.get("Example"):
        mapped_fields[mapping.get("Example", "Example")] = fields["Example"]
    if fields.get("Translation"):
        mapped_fields[mapping.get("Translation", "Translation")] = fields["Translation"]

    # Also pass through any fields not in the standard set
    standard_fields = ("Word", "Definition", "NativeDefinition", "Example", "Translation")
    for key, value in fields.items():
        if key not in standard_fields:
            mapped_fields[key] = value

    try:
        note_id = anki_service.create_note(deck_name, model_name, mapped_fields, tags)
        return Response.json({"noteId": note_id})
    except ValueError as e:
        return Response.error(str(e), 400)
    except RuntimeError as e:
        return Response.error(str(e))


def handle_get_note(params, _headers, _body):
    try:
        note_id = int(params.get("id", "0"))
    except ValueError:
        return Response.error("Invalid note ID", 400)
    if not note_id:
        return Response.error("Invalid note ID", 400)
    note = anki_service.get_note(note_id)
    if note is None:
        return Response.error("Note not found", 404)
    return Response.json({"note": note})


def handle_delete_note(params, _headers, _body):
    try:
        note_id = int(params.get("id", "0"))
    except ValueError:
        return Response.error("Invalid note ID", 400)
    if not note_id:
        return Response.error("Invalid note ID", 400)

    # Only allow deleting notes created by this app (tagged 'auto-generated')
    note = anki_service.get_note(note_id)
    if note is None:
        return Response.error("Note not found", 404)
    if "auto-generated" not in note.get("tags", []):
        return Response.error("Cannot delete notes not created by this app", 403)

    try:
        anki_service.delete_note(note_id)
        return Response.json({"success": True})
    except ValueError as e:
        return Response.error(str(e), 400)
    except RuntimeError as e:
        return Response.error(str(e))


def handle_sync(_params, _headers, _body):
    try:
        anki_service.sync()
        return Response.json({"success": True})
    except RuntimeError as e:
        return Response.error(str(e))


def handle_status(_params, _headers, _body):
    return Response.json(anki_service.get_status())
