"""Shared route modules — platform-agnostic Bottle route handlers.

Routes that need Anki accept the backend module as a parameter via
``register(app, anki)``. Routes that only use shared services take
just ``register(app)``.
"""
