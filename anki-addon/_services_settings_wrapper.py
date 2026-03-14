"""Addon-specific settings wrapper for _services/.

This file gets copied to _services/settings.py during build, replacing the
standalone server's file-based settings with Anki's addon config system.
The shared services (ai.py, providers, etc.) import get_settings from here.
"""

from __future__ import annotations

from anki_defs.services.settings_service import (  # noqa: F401
    get_settings,
    has_insecure_consent,
    keyring_available,
    mask_key,
    save_settings,
    set_insecure_consent,
)
