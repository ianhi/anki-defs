"""Route registration — wires shared routes to the addon's Anki backend."""

from anki_defs._services.routes import anki, chat, photo, prompts, session, settings
from anki_defs.server.app import app
from anki_defs.services import anki_service

_registered = False


def register_routes():
    global _registered
    if _registered:
        return
    _registered = True

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/platform")
    def platform():
        return {"platform": "anki-addon"}

    anki.register(app, anki_service)
    chat.register(app, anki_service)
    photo.register(app, anki_service)
    prompts.register(app)
    session.register(app)
    settings.register(app)
