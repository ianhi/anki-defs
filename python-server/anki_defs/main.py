"""Bottle application — main entry point for the Python server."""

from __future__ import annotations

import json
import logging
import os
import uuid

# Configure logging before importing modules that log at import time
logging.basicConfig(level=logging.INFO, format="%(name)s %(levelname)s: %(message)s")
log = logging.getLogger(__name__)

from bottle import Bottle, HTTPResponse, request, response, static_file  # noqa: E402

from .config import CLIENT_DIST, load_dotenv, migrate_config_dir  # noqa: E402
from .middleware.auth import check_auth  # noqa: E402
from .routes import anki, chat, prompts, session, settings  # noqa: E402
from .services.settings import get_settings, save_settings  # noqa: E402

# Migrate config dir from old name and load .env files
migrate_config_dir()
load_dotenv()

app = Bottle()

# --- CORS ---

ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://localhost:3001",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3001",
}


@app.hook("before_request")
def handle_cors_preflight() -> None:
    if request.method == "OPTIONS":
        origin = request.get_header("Origin", "")
        if origin in ALLOWED_ORIGINS:
            raise HTTPResponse(
                status=200,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Max-Age": "86400",
                },
            )
        raise HTTPResponse(status=200)


@app.hook("after_request")
def add_cors_headers() -> None:
    origin = request.get_header("Origin", "")
    if origin in ALLOWED_ORIGINS:
        response.set_header("Access-Control-Allow-Origin", origin)


# --- Auth ---


@app.hook("before_request")
def auth_hook() -> None:
    check_auth()


# --- JSON error handler ---


@app.error(404)
def error_404(err: Exception) -> str:
    response.content_type = "application/json"
    return json.dumps({"error": "Not Found"})


@app.error(500)
def error_500(err: Exception) -> str:
    response.content_type = "application/json"
    return json.dumps({"error": "Internal Server Error"})


# --- Platform routes ---


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/platform")
def platform() -> dict:
    return {"platform": "web"}


# --- Mount route modules ---

anki.register(app)
chat.register(app)
prompts.register(app)
session.register(app)
settings.register(app)

# --- Static file serving (production) ---

_WEB_DIR = str(CLIENT_DIST) if CLIENT_DIST.exists() else ""


if _WEB_DIR:

    @app.route("/")
    @app.route("/<filepath:path>")
    def serve_spa(filepath: str = "index.html") -> HTTPResponse:
        result = static_file(filepath, root=_WEB_DIR)
        if isinstance(result, HTTPResponse) and result.status_code == 404:
            ext = os.path.splitext(filepath)[1]
            if not ext:
                result = static_file("index.html", root=_WEB_DIR)
        return result


# --- Startup ---


def ensure_api_token() -> None:
    """Generate API token on first startup."""
    current = get_settings()
    if not current.get("apiToken"):
        token = str(uuid.uuid4())
        save_settings({"apiToken": token})
        log.info("Generated API token: %s", token)
    else:
        log.info("API token: ...%s", current["apiToken"][-4:])


def run(host: str = "0.0.0.0", port: int = 3001) -> None:
    """Run the server with a threaded WSGI backend."""
    from wsgiref.simple_server import WSGIRequestHandler, make_server

    ensure_api_token()

    class QuietHandler(WSGIRequestHandler):
        def log_request(self, code: str | int = "-", size: str | int = "-") -> None:
            pass

    from socketserver import ThreadingMixIn
    from wsgiref.simple_server import WSGIServer

    class ThreadedWSGIServer(ThreadingMixIn, WSGIServer):
        daemon_threads = True

    server = make_server(
        host, port, app, server_class=ThreadedWSGIServer, handler_class=QuietHandler  # type: ignore[arg-type]
    )
    log.info("Server listening on http://%s:%d", host, port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Shutting down")
        server.shutdown()
