"""Addon-specific settings wrapper for _services/.

This file gets copied to _services/settings.py during build, replacing the
standalone server's file-based settings with Anki's addon config system.
The shared services (ai.py, providers, etc.) import get_settings from here.
"""

from __future__ import annotations

from typing import Any

from anki_defs.services.settings_service import get_settings, save_settings  # noqa: F401


def mask_key(key: str) -> str:
    """Mask an API key for display (show last 4 chars)."""
    if not key:
        return ""
    return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + key[-4:]
