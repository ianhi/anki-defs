"""Anki routes — proxy to AnkiConnect via httpx."""

from __future__ import annotations

import logging

import httpx
from bottle import Bottle, request, response

from ..services import ai, anki_connect

log = logging.getLogger(__name__)

_VALID_CARD_TYPES = {"vocab", "cloze", "mcCloze"}


def register(app: Bottle) -> None:
    @app.get("/api/anki/decks")
    def get_decks() -> dict:
        try:
            decks = anki_connect.get_decks()
            return {"decks": decks}
        except httpx.HTTPError as e:
            log.error("Error fetching decks: %s", e)
            response.status = 500
            return {"error": "Failed to fetch decks. Is Anki running?"}
        except RuntimeError as e:
            log.error("Error fetching decks: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.get("/api/anki/models")
    def get_models() -> dict:
        try:
            models = anki_connect.get_models()
            return {"models": models}
        except httpx.HTTPError as e:
            log.error("Error fetching models: %s", e)
            response.status = 500
            return {"error": "Failed to fetch models. Is Anki running?"}
        except RuntimeError as e:
            log.error("Error fetching models: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.get("/api/anki/models/<name>/fields")
    def get_model_fields(name: str) -> dict:
        try:
            fields = anki_connect.get_model_fields(name)
            return {"fields": fields}
        except httpx.HTTPError as e:
            log.error("Error fetching model fields: %s", e)
            response.status = 500
            return {"error": "Failed to fetch model fields. Is Anki running?"}
        except RuntimeError as e:
            log.error("Error fetching model fields: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.post("/api/anki/search")
    def search_notes() -> dict:
        body = request.json or {}
        query = body.get("query", "")
        if not query:
            response.status = 400
            return {"error": "Query is required"}
        try:
            notes = anki_connect.search_notes(query)
            return {"notes": notes}
        except httpx.HTTPError as e:
            log.error("Error searching notes: %s", e)
            response.status = 500
            return {"error": "Failed to search notes. Is Anki running?"}
        except RuntimeError as e:
            log.error("Error searching notes: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.post("/api/anki/notes")
    def create_note() -> dict:
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
        if not word and card_type == "vocab":
            response.status = 400
            return {"error": "word is required for vocab cards"}

        try:
            if not body.get("approveMigration"):
                pending = anki_connect.check_migrations_for_deck(deck, [card_type])
                if pending:
                    response.status = 409
                    return {"migrationRequired": True, "migrations": pending}

            note_id, model_name = anki_connect.create_card(
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
        except httpx.HTTPError as e:
            log.error("Error creating note: %s", e)
            response.status = 503
            return {"error": "Could not connect to Anki. Is Anki running?"}
        except RuntimeError as e:
            log.error("Error creating note: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.get("/api/anki/notes/<note_id:int>")
    def get_note(note_id: int) -> dict:
        try:
            note = anki_connect.get_note_by_id(note_id)
            if note is None:
                response.status = 404
                return {"error": "Note not found"}
            return {"note": note}
        except httpx.HTTPError as e:
            log.error("Error fetching note: %s", e)
            response.status = 503
            return {"error": "Could not connect to Anki. Is Anki running?"}
        except RuntimeError as e:
            log.error("Error fetching note: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.delete("/api/anki/notes/<note_id:int>")
    def delete_note(note_id: int) -> dict:
        try:
            note = anki_connect.get_note_by_id(note_id)
            if note is None:
                response.status = 404
                return {"error": "Note not found"}
            if "auto-generated" not in note.get("tags", []):
                response.status = 403
                return {"error": "Cannot delete notes not created by this app"}
            anki_connect.delete_note(note_id)
            return {"success": True}
        except httpx.HTTPError as e:
            log.error("Error deleting note: %s", e)
            response.status = 503
            return {"error": "Could not connect to Anki. Is Anki running?"}
        except RuntimeError as e:
            log.error("Error deleting note: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.post("/api/anki/sync")
    def sync_anki() -> dict:
        try:
            anki_connect.sync()
            return {"success": True}
        except httpx.HTTPError as e:
            log.error("Error syncing Anki: %s", e)
            response.status = 500
            return {"error": "Failed to sync. Is Anki running?"}
        except RuntimeError as e:
            log.error("Error syncing Anki: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.get("/api/anki/status")
    def get_status() -> dict:
        try:
            connected = anki_connect.test_connection()
            return {"connected": connected}
        except (httpx.HTTPError, RuntimeError):
            return {"connected": False}

    @app.get("/api/anki/languages")
    def get_languages() -> dict:
        return {"languages": ai.get_available_languages()}
