"""Session API handlers."""

import json
import sqlite3

from ..server.web import Response
from ..services import session_service


def handle_get_session(_params, _headers, _body):
    try:
        state = session_service.get_state()
        return Response.json(state)
    except sqlite3.Error as e:
        return Response.error("Failed to get session state: {}".format(e))


def handle_add_card(_params, _headers, body):
    data = json.loads(body) if body else {}
    if not data.get("id") or not data.get("word"):
        return Response.error("id and word are required", 400)
    try:
        session_service.add_card(data)
        return Response.json({"success": True})
    except sqlite3.Error as e:
        return Response.error("Failed to add card: {}".format(e))


def handle_remove_card(params, _headers, _body):
    try:
        removed = session_service.remove_card(params["id"])
        return Response.json({"success": removed})
    except sqlite3.Error as e:
        return Response.error("Failed to remove card: {}".format(e))


def handle_add_pending(_params, _headers, body):
    data = json.loads(body) if body else {}
    if not data.get("id") or not data.get("word"):
        return Response.error("id and word are required", 400)
    try:
        session_service.add_pending(data)
        return Response.json({"success": True})
    except sqlite3.Error as e:
        return Response.error("Failed to add pending card: {}".format(e))


def handle_remove_pending(params, _headers, _body):
    try:
        removed = session_service.remove_pending(params["id"])
        return Response.json({"success": removed})
    except sqlite3.Error as e:
        return Response.error("Failed to remove pending card: {}".format(e))


def handle_promote_pending(params, _headers, body):
    data = json.loads(body) if body else {}
    note_id = data.get("noteId")
    if not note_id:
        return Response.error("noteId is required", 400)
    try:
        card = session_service.promote_pending(params["id"], note_id)
        if card is None:
            return Response.error("Pending card not found", 404)
        return Response.json({"success": True, "card": card})
    except sqlite3.Error as e:
        return Response.error("Failed to promote pending card: {}".format(e))


def handle_clear_session(_params, _headers, _body):
    try:
        session_service.clear_all()
        return Response.json({"success": True})
    except sqlite3.Error as e:
        return Response.error("Failed to clear session: {}".format(e))


# --- Usage tracking (new — from shared service layer) ---


def handle_get_usage(_params, _headers, _body):
    try:
        totals = session_service.get_usage_totals()
        return Response.json(totals)
    except sqlite3.Error as e:
        return Response.error("Failed to get usage: {}".format(e))


def handle_reset_usage(_params, _headers, _body):
    try:
        session_service.clear_usage()
        return Response.json({"success": True})
    except sqlite3.Error as e:
        return Response.error("Failed to reset usage: {}".format(e))


# --- History search (new — from shared service layer) ---


def handle_search_history(_params, headers, body):
    try:
        import urllib.parse

        query_string = headers.get("query_string", "")
        params = urllib.parse.parse_qs(query_string)
        q = params.get("q", [None])[0]
        limit = min(max(int(params.get("limit", ["50"])[0]), 1), 200)
        offset = max(int(params.get("offset", ["0"])[0]), 0)
        result = session_service.search_history(q, limit, offset)
        return Response.json(result)
    except sqlite3.Error as e:
        return Response.error("Failed to search history: {}".format(e))
    except ValueError as e:
        return Response.error("Invalid parameter: {}".format(e), 400)
