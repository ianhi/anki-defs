"""Session API handlers."""

import json
from ..server.web import Response
from ..services import session_service


def handle_get_session(_params, _headers, _body):
    try:
        state = session_service.get_state()
        return Response.json(state)
    except Exception as e:
        return Response.error("Failed to get session state: {}".format(e))


def handle_add_card(_params, _headers, body):
    data = json.loads(body) if body else {}
    if not data.get("id") or not data.get("word"):
        return Response.error("id and word are required", 400)
    try:
        session_service.add_card(data)
        return Response.json({"success": True})
    except Exception as e:
        return Response.error("Failed to add card: {}".format(e))


def handle_remove_card(params, _headers, _body):
    try:
        removed = session_service.remove_card(params["id"])
        return Response.json({"success": removed})
    except Exception as e:
        return Response.error("Failed to remove card: {}".format(e))


def handle_add_pending(_params, _headers, body):
    data = json.loads(body) if body else {}
    if not data.get("id") or not data.get("word"):
        return Response.error("id and word are required", 400)
    try:
        session_service.add_pending(data)
        return Response.json({"success": True})
    except Exception as e:
        return Response.error("Failed to add pending card: {}".format(e))


def handle_remove_pending(params, _headers, _body):
    try:
        removed = session_service.remove_pending(params["id"])
        return Response.json({"success": removed})
    except Exception as e:
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
    except Exception as e:
        return Response.error("Failed to promote pending card: {}".format(e))


def handle_clear_session(_params, _headers, _body):
    try:
        session_service.clear_all()
        return Response.json({"success": True})
    except Exception as e:
        return Response.error("Failed to clear session: {}".format(e))
