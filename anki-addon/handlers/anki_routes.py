"""Anki collection API handlers."""

import json
from urllib.parse import unquote

from ..server.web import Response
from ..services import anki_service

_VALID_CARD_TYPES = ("vocab", "cloze", "mcCloze")


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
    """Create a note from a domain payload.

    The handler accepts the new `CreateNoteRequest` shape: the client sends
    deck + cardType + card content, and the server resolves the language,
    ensures the matching auto-created note type exists, and builds the
    field map.
    """
    try:
        data = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return Response.error("Invalid JSON", 400)

    deck = data.get("deck", "")
    card_type = data.get("cardType", "vocab")
    word = data.get("word", "")

    if not deck:
        return Response.error("deck is required", 400)
    if card_type not in _VALID_CARD_TYPES:
        return Response.error("Invalid cardType: {}".format(card_type), 400)
    if card_type == "vocab" and not word:
        return Response.error("word is required for vocab cards", 400)

    try:
        note_id, model_name = anki_service.create_card(
            deck=deck,
            card_type=card_type,
            word=word,
            definition=data.get("definition", ""),
            native_definition=data.get("nativeDefinition", ""),
            example=data.get("example", ""),
            translation=data.get("translation", ""),
            vocab_templates=data.get("vocabTemplates"),
            tags=data.get("tags"),
        )
        return Response.json({"noteId": note_id, "modelName": model_name})
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
