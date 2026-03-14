"""Addon-specific settings wrapper for _services/.

This file gets copied to _services/settings.py during build, replacing the
standalone server's file-based settings with Anki's addon config system.
The shared services (ai.py, providers, etc.) import get_settings from here.
"""

from __future__ import annotations

from typing import Any


def get_settings() -> dict[str, Any]:
    """Delegate to addon's settings service (Anki config system)."""
    from ..services.settings_service import get_settings as _get

    return _get()


def save_settings(updates: dict[str, Any]) -> dict[str, Any]:
    """Delegate to addon's settings service."""
    from ..services.settings_service import save_settings as _save

    return _save(updates)


def mask_key(key: str) -> str:
    """Mask an API key for display (show last 4 chars)."""
    if not key:
        return ""
    return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + key[-4:]
