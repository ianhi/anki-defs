"""Platform and health check handlers."""

from ..server.web import Response


def handle_health(_params, _headers, _body):
    return Response.json({"status": "ok"})


def handle_platform(_params, _headers, _body):
    return Response.json({"platform": "anki-addon"})
