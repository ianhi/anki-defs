"""anki-defs: Vocabulary flashcard tool for Anki Desktop.

Runs a local HTTP server inside Anki, serving the React frontend and
implementing the same API contract as the Python/FastAPI backend.
"""

import os
import sys
import threading
import uuid
import webbrowser

# Add bundled vendor packages (httpx, keyring, bottle, etc.) to import path
_vendor_dir = os.path.join(os.path.dirname(__file__), "_vendor")
if os.path.isdir(_vendor_dir) and _vendor_dir not in sys.path:
    sys.path.insert(0, _vendor_dir)

# D-Bus fix and keyring probe run at import time in settings_base
from aqt import gui_hooks, mw  # noqa: E402
from aqt.qt import QAction, qconnect  # noqa: E402

PORT = 28735


class AnkiDefsAddon:
    def __init__(self):
        self._server = None
        self._thread = None

    def _ensure_api_token(self):
        """Generate an API token on first startup."""
        config = mw.addonManager.getConfig(__name__) or {}
        if not config.get("apiToken"):
            config["apiToken"] = str(uuid.uuid4())
            mw.addonManager.writeConfig(__name__.split(".")[0], config)
        return config

    def _get_token(self):
        """Return the current API token (called per-request by auth hook)."""
        config = mw.addonManager.getConfig(__name__) or {}
        return config.get("apiToken", "")

    def on_profile_loaded(self):
        """Called when user profile is loaded (collection available)."""
        from .handlers import register_routes
        from .server.app import app, configure_auth

        config = self._ensure_api_token()
        port = config.get("port", PORT)

        configure_auth(self._get_token)
        register_routes()

        from socketserver import ThreadingMixIn
        from wsgiref.simple_server import WSGIRequestHandler, WSGIServer, make_server

        class QuietHandler(WSGIRequestHandler):
            def log_request(self, code="-", size="-"):
                pass

            def handle(self):
                try:
                    super().handle()
                except (ConnectionResetError, BrokenPipeError) as e:
                    # Client disconnected before we could read/write.
                    # Normal with mobile browsers — not worth an error dialog.
                    import logging
                    logging.getLogger("anki_defs.server").debug(
                        "Client disconnected: %s", e
                    )

            def get_stderr(self):
                # Anki's ErrorHandler lacks flush(), which wsgiref requires.
                # Wrap it so error dialogs still work without mutating the original.
                stderr = super().get_stderr()
                if hasattr(stderr, "flush"):
                    return stderr

                class _FlushableWrapper:
                    def write(self, msg):
                        return stderr.write(msg)

                    def writelines(self, lines):
                        for line in lines:
                            stderr.write(line)

                    def flush(self):
                        pass

                return _FlushableWrapper()

        class ThreadedWSGIServer(ThreadingMixIn, WSGIServer):
            daemon_threads = True

        try:
            self._server = make_server(
                "0.0.0.0", port, app,
                server_class=ThreadedWSGIServer,
                handler_class=QuietHandler,
            )
        except OSError as e:
            from aqt.utils import showWarning

            showWarning(
                f"anki-defs: Could not start server on port {port}: {e}\n"
                "Check if another instance is running."
            )
            self._server = None
            return

        self._thread = threading.Thread(
            target=self._server.serve_forever,
            daemon=True,
        )
        self._thread.start()

    def on_profile_will_close(self):
        """Cleanup before profile close."""
        if self._server:
            self._server.shutdown()
            self._server = None
        self._thread = None

    def open_browser(self):
        config = mw.addonManager.getConfig(__name__) or {}
        port = config.get("port", PORT)
        webbrowser.open("http://localhost:{}".format(port))


addon = AnkiDefsAddon()

# Register hooks
gui_hooks.profile_did_open.append(addon.on_profile_loaded)
gui_hooks.profile_will_close.append(addon.on_profile_will_close)

# Add menu item
action = QAction("anki-defs", mw)
qconnect(action.triggered, addon.open_browser)
mw.form.menuTools.addAction(action)
