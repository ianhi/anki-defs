"""Settings management using Anki's add-on config system.

Defaults are loaded from shared/defaults/settings.json (the cross-backend
source of truth). Add-on-specific settings (port) are added on top.
"""

import json
import os

from aqt import mw

# Packaged addon has _shared/ inside the addon dir; dev install uses repo-relative path.
# Resolve symlinks so dev installs (symlinked into Anki addons dir) find the repo.
_ADDON_DIR = os.path.realpath(os.path.dirname(os.path.dirname(__file__)))
_PACKAGED_PATH = os.path.join(_ADDON_DIR, "_shared", "defaults", "settings.json")
_REPO_PATH = os.path.join(os.path.dirname(_ADDON_DIR), "shared", "defaults", "settings.json")
_SHARED_DEFAULTS_PATH = _PACKAGED_PATH if os.path.isfile(_PACKAGED_PATH) else _REPO_PATH

_ADDON_DEFAULTS = {
    "port": 28735,
}


def _load_defaults():
    """Load defaults from shared settings file, with add-on-specific additions."""
    defaults = {}
    try:
        with open(_SHARED_DEFAULTS_PATH, "r", encoding="utf-8") as f:
            defaults = json.load(f)
    except (OSError, json.JSONDecodeError):
        pass
    defaults.update(_ADDON_DEFAULTS)
    return defaults


# __name__ resolves to the add-on package name when loaded by Anki
_addon_name = __name__.split(".")[0]


def get_settings():
    """Get current settings (merged with defaults)."""
    config = mw.addonManager.getConfig(_addon_name) or {}
    result = _load_defaults()
    result.update(config)
    return result


def save_settings(updates):
    """Save partial settings update. Returns the full merged settings."""
    config = mw.addonManager.getConfig(_addon_name) or {}
    config.update(updates)
    mw.addonManager.writeConfig(_addon_name, config)
    result = _load_defaults()
    result.update(config)
    return result


def get_masked_settings():
    """Get settings with API keys masked."""
    settings = get_settings()
    masked = dict(settings)
    for key in ("claudeApiKey", "geminiApiKey", "openRouterApiKey"):
        val = masked.get(key, "")
        if val:
            masked[key] = "--------" + val[-4:]
        else:
            masked[key] = ""
    return masked
