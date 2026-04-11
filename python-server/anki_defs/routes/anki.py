"""Anki routes — proxy to AnkiConnect via httpx."""

from __future__ import annotations

import asyncio
import logging

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..services import ai, anki_connect

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/anki")


@router.get("/decks")
async def get_decks() -> JSONResponse:
    try:
        decks = await asyncio.to_thread(anki_connect.get_decks)
        return JSONResponse({"decks": decks})
    except httpx.HTTPError as e:
        log.error("Error fetching decks: %s", e)
        return JSONResponse(
            {"error": "Failed to fetch decks. Is Anki running?"}, status_code=500
        )
    except RuntimeError as e:
        log.error("Error fetching decks: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/models")
async def get_models() -> JSONResponse:
    try:
        models = await asyncio.to_thread(anki_connect.get_models)
        return JSONResponse({"models": models})
    except httpx.HTTPError as e:
        log.error("Error fetching models: %s", e)
        return JSONResponse(
            {"error": "Failed to fetch models. Is Anki running?"}, status_code=500
        )
    except RuntimeError as e:
        log.error("Error fetching models: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/models/{name}/fields")
async def get_model_fields(name: str) -> JSONResponse:
    try:
        fields = await asyncio.to_thread(anki_connect.get_model_fields, name)
        return JSONResponse({"fields": fields})
    except httpx.HTTPError as e:
        log.error("Error fetching model fields: %s", e)
        return JSONResponse(
            {"error": "Failed to fetch model fields. Is Anki running?"}, status_code=500
        )
    except RuntimeError as e:
        log.error("Error fetching model fields: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/search")
async def search_notes(request: Request) -> JSONResponse:
    body = await request.json()
    query = body.get("query", "")
    if not query:
        return JSONResponse({"error": "Query is required"}, status_code=400)
    try:
        notes = await asyncio.to_thread(anki_connect.search_notes, query)
        return JSONResponse({"notes": notes})
    except httpx.HTTPError as e:
        log.error("Error searching notes: %s", e)
        return JSONResponse(
            {"error": "Failed to search notes. Is Anki running?"}, status_code=500
        )
    except RuntimeError as e:
        log.error("Error searching notes: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


_VALID_CARD_TYPES = {"vocab", "cloze", "mcCloze"}


@router.post("/notes")
async def create_note(request: Request) -> JSONResponse:
    """Create a note from a domain payload.

    The client sends the card content and which deck/card type it belongs
    to. The server resolves the language, ensures the matching auto-created
    note type exists in Anki, and builds the field map.
    """
    body = await request.json()
    deck = body.get("deck", "")
    card_type = body.get("cardType", "vocab")
    word = body.get("word", "")
    definition = body.get("definition", "")
    native_definition = body.get("nativeDefinition", "")
    example = body.get("example", "")
    translation = body.get("translation", "")
    vocab_templates = body.get("vocabTemplates")
    tags = body.get("tags")

    if not deck:
        return JSONResponse({"error": "deck is required"}, status_code=400)
    if card_type not in _VALID_CARD_TYPES:
        return JSONResponse(
            {"error": f"Invalid cardType: {card_type}"}, status_code=400
        )
    if not word and card_type == "vocab":
        return JSONResponse({"error": "word is required for vocab cards"}, status_code=400)

    try:
        note_id, model_name = await asyncio.to_thread(
            anki_connect.create_card,
            deck=deck,
            card_type=card_type,
            word=word,
            definition=definition,
            native_definition=native_definition,
            example=example,
            translation=translation,
            vocab_templates=vocab_templates,
            tags=tags,
        )
        return JSONResponse({"noteId": note_id, "modelName": model_name})
    except httpx.HTTPError as e:
        log.error("Error creating note: %s", e)
        return JSONResponse(
            {"error": "Could not connect to Anki. Is Anki running?"}, status_code=503
        )
    except RuntimeError as e:
        log.error("Error creating note: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/notes/{note_id}")
async def get_note(note_id: int) -> JSONResponse:
    try:
        note = await asyncio.to_thread(anki_connect.get_note_by_id, note_id)
        if note is None:
            return JSONResponse({"error": "Note not found"}, status_code=404)
        return JSONResponse({"note": note})
    except httpx.HTTPError as e:
        log.error("Error fetching note: %s", e)
        return JSONResponse(
            {"error": "Could not connect to Anki. Is Anki running?"}, status_code=503
        )
    except RuntimeError as e:
        log.error("Error fetching note: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.delete("/notes/{note_id}")
async def delete_note(note_id: int) -> JSONResponse:
    try:
        note = await asyncio.to_thread(anki_connect.get_note_by_id, note_id)
        if note is None:
            return JSONResponse({"error": "Note not found"}, status_code=404)
        if "auto-generated" not in note.get("tags", []):
            return JSONResponse(
                {"error": "Cannot delete notes not created by this app"}, status_code=403
            )
        await asyncio.to_thread(anki_connect.delete_note, note_id)
        return JSONResponse({"success": True})
    except httpx.HTTPError as e:
        log.error("Error deleting note: %s", e)
        return JSONResponse(
            {"error": "Could not connect to Anki. Is Anki running?"}, status_code=503
        )
    except RuntimeError as e:
        log.error("Error deleting note: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/sync")
async def sync_anki() -> JSONResponse:
    try:
        await asyncio.to_thread(anki_connect.sync)
        return JSONResponse({"success": True})
    except httpx.HTTPError as e:
        log.error("Error syncing Anki: %s", e)
        return JSONResponse(
            {"error": "Failed to sync. Is Anki running?"}, status_code=500
        )
    except RuntimeError as e:
        log.error("Error syncing Anki: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/status")
async def get_status() -> JSONResponse:
    try:
        connected = await asyncio.to_thread(anki_connect.test_connection)
        return JSONResponse({"connected": connected})
    except (httpx.HTTPError, RuntimeError):
        return JSONResponse({"connected": False})


@router.get("/languages")
async def get_languages() -> JSONResponse:
    """Return available language definitions."""
    return JSONResponse({"languages": ai.get_available_languages()})
