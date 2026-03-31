"""Platform and health check handlers."""

from ..server.web import Response
from ..services import ai_service


def handle_health(_params, _headers, _body):
    return Response.json({"status": "ok"})


def handle_platform(_params, _headers, _body):
    return Response.json({"platform": "anki-addon"})


def handle_languages(_params, _headers, _body):
    """GET /api/languages — available language definitions."""
    languages = ai_service.get_available_languages()
    return Response.json({"languages": languages})
