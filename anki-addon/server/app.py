"""Bottle application for the Anki addon — runs in a daemon thread."""

import json
import mimetypes
import os

from bottle import BaseRequest, Bottle, HTTPResponse, request, response, static_file

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")

BaseRequest.MEMFILE_MAX = 20 * 1024 * 1024  # 20 MB for photo uploads

WEB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web")

app = Bottle()

_get_token = None


def configure_auth(get_token_fn):
    global _get_token
    _get_token = get_token_fn


def _is_trusted_ip(ip):
    """Localhost or Tailscale CGNAT (100.64.0.0/10)."""
    if ip in ("127.0.0.1", "::1"):
        return True
    parts = ip.split(".")
    if len(parts) == 4:
        try:
            first, second = int(parts[0]), int(parts[1])
            if first == 100 and 64 <= second <= 127:
                return True
        except ValueError:
            pass
    return False


# --- Hooks ---


@app.hook("before_request")
def handle_cors_preflight():
    if request.method == "OPTIONS":
        raise HTTPResponse(
            status=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Max-Age": "86400",
            },
        )


@app.hook("after_request")
def add_cors_headers():
    response.set_header("Access-Control-Allow-Origin", "*")


@app.hook("before_request")
def check_auth():
    if not request.path.startswith("/api"):
        return
    if not _get_token:
        return
    remote = request.remote_addr or "127.0.0.1"
    if _is_trusted_ip(remote):
        return
    token = _get_token()
    if not token:
        raise HTTPResponse(
            status=401,
            body='{"error":"API token not configured"}',
            Content_Type="application/json",
        )
    auth = request.get_header("Authorization", "")
    if auth != "Bearer {}".format(token):
        raise HTTPResponse(
            status=401,
            body='{"error":"Invalid or missing API token"}',
            Content_Type="application/json",
        )


# --- Error handlers ---


@app.error(404)
def error_404(err):
    response.content_type = "application/json"
    return json.dumps({"error": "Not Found"})


@app.error(500)
def error_500(err):
    response.content_type = "application/json"
    return json.dumps({"error": "Internal Server Error"})


# --- Static file serving with SPA fallback ---


@app.route("/")
@app.route("/<filepath:path>")
def serve_spa(filepath="index.html"):
    if filepath.startswith("api/"):
        response.status = 404
        response.content_type = "application/json"
        return json.dumps({"error": "Not Found"})

    result = static_file(filepath, root=WEB_DIR)
    if isinstance(result, HTTPResponse) and result.status_code == 404:
        ext = os.path.splitext(filepath)[1]
        if not ext:
            result = static_file("index.html", root=WEB_DIR)

    if isinstance(result, HTTPResponse) and "/assets/" in filepath:
        result.set_header("Cache-Control", "public, max-age=31536000, immutable")
    elif isinstance(result, HTTPResponse):
        result.set_header("Cache-Control", "no-cache")

    return result
