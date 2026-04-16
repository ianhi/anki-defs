"""Anki collection API routes."""

import logging
from urllib.parse import unquote

from bottle import request, response

from ..services import anki_service

log = logging.getLogger(__name__)

_VALID_CARD_TYPES = ("vocab", "cloze", "mcCloze")


def register(app):
    @app.get("/api/anki/decks")
    def get_decks():
        try:
            decks = anki_service.get_decks()
            return {"decks": decks}
        except RuntimeError as e:
            log.error("Error fetching decks: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.get("/api/anki/models")
    def get_models():
        try:
            models = anki_service.get_models()
            return {"models": models}
        except RuntimeError as e:
            log.error("Error fetching models: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.get("/api/anki/models/<name>/fields")
    def get_model_fields(name):
        try:
            name = unquote(name)
            fields = anki_service.get_model_fields(name)
            return {"fields": fields}
        except ValueError as e:
            response.status = 400
            return {"error": str(e)}
        except RuntimeError as e:
            log.error("Error fetching model fields: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.post("/api/anki/search")
    def search_notes():
        body = request.json or {}
        query = body.get("query", "")
        if not query:
            response.status = 400
            return {"error": "Query is required"}
        try:
            notes = anki_service.search_notes(query)
            return {"notes": notes}
        except RuntimeError as e:
            log.error("Error searching notes: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.post("/api/anki/notes")
    def create_note():
        body = request.json or {}
        deck = body.get("deck", "")
        card_type = body.get("cardType", "vocab")
        word = body.get("word", "")

        if not deck:
            response.status = 400
            return {"error": "deck is required"}
        if card_type not in _VALID_CARD_TYPES:
            response.status = 400
            return {"error": f"Invalid cardType: {card_type}"}
        if card_type == "vocab" and not word:
            response.status = 400
            return {"error": "word is required for vocab cards"}

        try:
            note_id, model_name = anki_service.create_card(
                deck=deck,
                card_type=card_type,
                word=word,
                definition=body.get("definition", ""),
                native_definition=body.get("nativeDefinition", ""),
                example=body.get("example", ""),
                translation=body.get("translation", ""),
                vocab_templates=body.get("vocabTemplates"),
                tags=body.get("tags"),
            )
            return {"noteId": note_id, "modelName": model_name}
        except ValueError as e:
            response.status = 400
            return {"error": str(e)}
        except RuntimeError as e:
            log.error("Error creating note: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.get("/api/anki/notes/<note_id:int>")
    def get_note(note_id):
        note = anki_service.get_note(note_id)
        if note is None:
            response.status = 404
            return {"error": "Note not found"}
        return {"note": note}

    @app.delete("/api/anki/notes/<note_id:int>")
    def delete_note(note_id):
        note = anki_service.get_note(note_id)
        if note is None:
            response.status = 404
            return {"error": "Note not found"}
        if "auto-generated" not in note.get("tags", []):
            response.status = 403
            return {"error": "Cannot delete notes not created by this app"}
        try:
            anki_service.delete_note(note_id)
            return {"success": True}
        except ValueError as e:
            response.status = 400
            return {"error": str(e)}
        except RuntimeError as e:
            log.error("Error deleting note: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.post("/api/anki/sync")
    def sync():
        try:
            anki_service.sync()
            return {"success": True}
        except RuntimeError as e:
            log.error("Error syncing: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.get("/api/anki/status")
    def status():
        return anki_service.get_status()
