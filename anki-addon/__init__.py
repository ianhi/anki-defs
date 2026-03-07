"""anki-defs: Vocabulary flashcard tool for Anki Desktop.

Runs a local HTTP server inside Anki, serving the React frontend and
implementing the same API contract as the Node.js/Express backend.
"""

from aqt import mw, gui_hooks
from aqt.qt import QAction, QTimer, qconnect
import webbrowser

PORT = 28735


class AnkiDefsAddon:
    def __init__(self):
        self.server = None
        self.timer = None

    def on_profile_loaded(self):
        """Called when user profile is loaded (collection available)."""
        from .server.web import WebServer
        from .handlers import create_router

        # Read port from config
        config = mw.addonManager.getConfig(__name__) or {}
        port = config.get("port", PORT)

        router = create_router()
        self.server = WebServer(router.handle)
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
