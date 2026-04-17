"""Route registration — registers all API handlers on the Bottle app."""

from ..server.app import app
from . import (
    anki_routes,
    chat_routes,
    photo_routes,
    platform_routes,
    session_routes,
    settings_routes,
)

_registered = False


def register_routes():
    global _registered
    if _registered:
        return
    _registered = True

    platform_routes.register(app)
    anki_routes.register(app)
    chat_routes.register(app)
    settings_routes.register(app)
    photo_routes.register(app)
    session_routes.register(app)
