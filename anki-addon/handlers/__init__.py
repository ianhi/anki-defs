"""Route registration -- creates the router with all API handlers."""

from ..server.router import Router
from . import anki_routes, chat_routes, platform_routes, session_routes, settings_routes


def create_router():
    router = Router()

    # Health / platform
    router.get("/api/health", platform_routes.handle_health)
    router.get("/api/platform", platform_routes.handle_platform)

    # Anki collection routes
    router.get("/api/anki/decks", anki_routes.handle_get_decks)
    router.get("/api/anki/models", anki_routes.handle_get_models)
    router.get("/api/anki/models/:name/fields", anki_routes.handle_get_model_fields)
    router.post("/api/anki/search", anki_routes.handle_search)
    router.post("/api/anki/notes", anki_routes.handle_create_note)
    router.get("/api/anki/notes/:id", anki_routes.handle_get_note)
    router.delete("/api/anki/notes/:id", anki_routes.handle_delete_note)
    router.post("/api/anki/sync", anki_routes.handle_sync)
    router.get("/api/anki/status", anki_routes.handle_status)

    # Chat routes
    router.post("/api/chat/stream", chat_routes.handle_stream)
    router.post("/api/chat/distractors", chat_routes.handle_distractors)
    router.post("/api/chat/relemmatize", chat_routes.handle_relemmatize)

    # Settings
    router.get("/api/settings", settings_routes.handle_get_settings)
    router.put("/api/settings", settings_routes.handle_put_settings)

    # Session
    router.get("/api/session", session_routes.handle_get_session)
    router.post("/api/session/cards", session_routes.handle_add_card)
    router.delete("/api/session/cards/:id", session_routes.handle_remove_card)
    router.post("/api/session/pending", session_routes.handle_add_pending)
    router.delete("/api/session/pending/:id", session_routes.handle_remove_pending)
    router.post("/api/session/pending/:id/promote", session_routes.handle_promote_pending)
    router.post("/api/session/clear", session_routes.handle_clear_session)
    router.get("/api/session/usage", session_routes.handle_get_usage)
    router.post("/api/session/usage/reset", session_routes.handle_reset_usage)
    router.get("/api/session/history", session_routes.handle_search_history)

    # Prompts
    router.post("/api/prompts/preview", chat_routes.handle_prompt_preview)

    return router
