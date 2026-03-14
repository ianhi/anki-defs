"""anki-defs: Vocabulary flashcard tool for Anki Desktop.

Runs a local HTTP server inside Anki, serving the React frontend and
implementing the same API contract as the Python/FastAPI backend.
"""

import os
import sys
import uuid
import webbrowser

# Add bundled vendor packages (httpx, etc.) to import path
_vendor_dir = os.path.join(os.path.dirname(__file__), "_vendor")
if os.path.isdir(_vendor_dir) and _vendor_dir not in sys.path:
    sys.path.insert(0, _vendor_dir)

from aqt import gui_hooks, mw  # noqa: E402
from aqt.qt import QAction, QTimer, qconnect  # noqa: E402

PORT = 28735


class AnkiDefsAddon:
    def __init__(self):
        self.server = None
        self.timer = None

    def _ensure_api_token(self):
        """Generate an API token on first startup."""
        config = mw.addonManager.getConfig(__name__) or {}
        if not config.get("apiToken"):
            config["apiToken"] = str(uuid.uuid4())
            mw.addonManager.writeConfig(__name__.split(".")[0], config)
        return config

    def _get_token(self):
        """Return the current API token (called per-request by WebServer)."""
        config = mw.addonManager.getConfig(__name__) or {}
        return config.get("apiToken", "")

    def on_profile_loaded(self):
        """Called when user profile is loaded (collection available)."""
        from .handlers import create_router
        from .server.web import WebServer

        # Read port from config, generate token if needed
        config = self._ensure_api_token()
        port = config.get("port", PORT)

        router = create_router()
        self.server = WebServer(router.handle, get_token=self._get_token)
        try:
            self.server.listen(port)
        except OSError as e:
            from aqt.utils import showWarning

            showWarning(
                f"anki-defs: Could not start server on port {port}: {e}\n"
                "Check if another instance is running."
            )
            self.server = None
            return

        self.timer = QTimer()
        self.timer.timeout.connect(self.server.advance)
        self.timer.start(25)  # 25ms poll interval

    def on_profile_will_close(self):
        """Cleanup before profile close."""
        if self.timer:
            self.timer.stop()
            self.timer = None
        if self.server:
            self.server.close()
            self.server = None

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
