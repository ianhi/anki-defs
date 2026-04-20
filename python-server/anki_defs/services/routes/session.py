"""Session routes — CRUD for cards, pending, usage, history."""

from __future__ import annotations

import logging
import sqlite3
from typing import Any

from bottle import request, response

from .. import session as session_service

log = logging.getLogger(__name__)


def register(app: Any) -> None:
    @app.get("/api/session")
    def get_session() -> dict:
        try:
            return session_service.get_state()
        except sqlite3.Error as e:
            log.error("Error getting state: %s", e)
            response.status = 500
            return {"error": "Failed to get session state"}

    @app.post("/api/session/cards")
    def add_card() -> dict:
        card = request.json or {}
        if not card.get("id") or not card.get("word"):
            response.status = 400
            return {"error": "id and word are required"}
        try:
            session_service.add_card(card)
            return {"success": True}
        except sqlite3.Error as e:
            log.error("Error adding card: %s", e)
            response.status = 500
            return {"error": "Failed to add card"}

    @app.delete("/api/session/cards/<card_id>")
    def remove_card(card_id: str) -> dict:
        try:
            removed = session_service.remove_card(card_id)
            return {"success": removed}
        except sqlite3.Error as e:
            log.error("Error removing card: %s", e)
            response.status = 500
            return {"error": "Failed to remove card"}

    @app.post("/api/session/pending")
    def add_pending() -> dict:
        card = request.json or {}
        if not card.get("id") or not card.get("word"):
            response.status = 400
            return {"error": "id and word are required"}
        try:
            session_service.add_pending(card)
            return {"success": True}
        except sqlite3.Error as e:
            log.error("Error adding pending card: %s", e)
            response.status = 500
            return {"error": "Failed to add pending card"}

    @app.delete("/api/session/pending/<card_id>")
    def remove_pending(card_id: str) -> dict:
        try:
            removed = session_service.remove_pending(card_id)
            return {"success": removed}
        except sqlite3.Error as e:
            log.error("Error removing pending card: %s", e)
            response.status = 500
            return {"error": "Failed to remove pending card"}

    @app.post("/api/session/pending/<pending_id>/promote")
    def promote_pending(pending_id: str) -> dict:
        body = request.json or {}
        note_id = body.get("noteId")
        if not note_id:
            response.status = 400
            return {"error": "noteId is required"}
        try:
            card = session_service.promote_pending(pending_id, note_id)
            if card is None:
                response.status = 404
                return {"error": "Pending card not found"}
            return {"success": True, "card": card}
        except sqlite3.Error as e:
            log.error("Error promoting pending card: %s", e)
            response.status = 500
            return {"error": "Failed to promote pending card"}

    @app.post("/api/session/clear")
    def clear_session() -> dict:
        try:
            session_service.clear_all()
            return {"success": True}
        except sqlite3.Error as e:
            log.error("Error clearing session: %s", e)
            response.status = 500
            return {"error": "Failed to clear session"}

    @app.get("/api/session/usage")
    def get_usage() -> dict:
        try:
            return session_service.get_usage_totals()
        except sqlite3.Error as e:
            log.error("Error getting usage: %s", e)
            response.status = 500
            return {"error": "Failed to get usage"}

    @app.post("/api/session/usage/reset")
    def reset_usage() -> dict:
        try:
            session_service.clear_usage()
            return {"success": True}
        except sqlite3.Error as e:
            log.error("Error resetting usage: %s", e)
            response.status = 500
            return {"error": "Failed to reset usage"}

    @app.get("/api/session/history")
    def search_history() -> dict:
        q = request.query.get("q")  # type: ignore[attr-defined]
        try:
            limit = min(max(int(request.query.get("limit", "50")), 1), 200)  # type: ignore[attr-defined]
            offset = max(int(request.query.get("offset", "0")), 0)  # type: ignore[attr-defined]
        except ValueError:
            limit = 50
            offset = 0
        try:
            return session_service.search_history(q, limit, offset)
        except sqlite3.Error as e:
            log.error("Error searching history: %s", e)
            response.status = 500
            return {"error": "Failed to search history"}
