"""Platform and health check routes."""

from anki_defs._services import ai as ai_service


def register(app):
    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/platform")
    def platform():
        return {"platform": "anki-addon"}

    @app.get("/api/anki/languages")
    def languages():
        return {"languages": ai_service.get_available_languages()}
