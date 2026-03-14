"""Settings management using Anki's add-on config + system keyring for secrets.

Platform adapter for anki-addon: stores non-secret settings in Anki's addon
config (meta.json), secrets in the system keyring (with fallback to addon
config if keyring is unavailable, requiring user consent).
Defaults loaded from shared/defaults/settings.json.
"""

import json
import os

import anki_defs._services.settings_base as settings_base
from anki_defs._services.settings_base import (
    SECRET_FIELDS,
    get_masked,
    get_secrets,
    has_new_secrets,
    is_masked,
    keyring_available,
    mask_key,
    strip_masked_keys,
)
from aqt import mw

# Re-export for consumers
__all__ = [
    "get_settings",
    "save_settings",
    "get_masked_settings",
    "mask_key",
    "keyring_available",
    "has_insecure_consent",
    "set_insecure_consent",
    "has_new_secrets",
    "is_masked",
    "strip_masked_keys",
]

# Packaged addon has _shared/ inside the addon dir; dev install uses repo-relative path.
# Resolve symlinks so dev installs (symlinked into Anki addons dir) find the repo.
_ADDON_DIR = os.path.realpath(os.path.dirname(os.path.dirname(__file__)))
_PACKAGED_PATH = os.path.join(_ADDON_DIR, "_shared", "defaults", "settings.json")
_REPO_PATH = os.path.join(os.path.dirname(_ADDON_DIR), "shared", "defaults", "settings.json")
_SHARED_DEFAULTS_PATH = _PACKAGED_PATH if os.path.isfile(_PACKAGED_PATH) else _REPO_PATH

_ADDON_DEFAULTS = {
    "port": 28735,
}

# __name__ resolves to the add-on package name when loaded by Anki
_addon_name = __name__.split(".")[0]


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


# ---------------------------------------------------------------------------
# Fallback callbacks (used when keyring is unavailable)
# ---------------------------------------------------------------------------


def _fallback_read(field):
    """Read a secret from Anki addon config."""
    config = mw.addonManager.getConfig(_addon_name) or {}
    return config.get(field, "")


def _fallback_write(field, value):
    """Write a secret to Anki addon config."""
    config = mw.addonManager.getConfig(_addon_name) or {}
    if value:
        config[field] = value
    else:
        config.pop(field, None)
    mw.addonManager.writeConfig(_addon_name, config)


# ---------------------------------------------------------------------------
# Consent tracking (stored in Anki addon config)
# ---------------------------------------------------------------------------


def has_insecure_consent():
    """Check if user previously consented to insecure (plain text) storage."""
    config = mw.addonManager.getConfig(_addon_name) or {}
    return config.get("_insecureStorageConsent", False)


def set_insecure_consent(value):
    """Store the user's consent for insecure storage."""
    config = mw.addonManager.getConfig(_addon_name) or {}
    if value:
        config["_insecureStorageConsent"] = True
    else:
        config.pop("_insecureStorageConsent", None)
    mw.addonManager.writeConfig(_addon_name, config)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_settings():
    """Get current settings (defaults < anki config < secrets)."""
    config = mw.addonManager.getConfig(_addon_name) or {}
    # When using keyring, strip secrets from config (migration from plain text)
    if keyring_available():
        for field in SECRET_FIELDS:
            config.pop(field, None)
    result = _load_defaults()
    result.update(config)
    result.update(get_secrets(_fallback_read))
    return result


def save_settings(updates):
    """Save partial settings update. Secrets go to keyring (or fallback), rest to Anki config."""
    secret_updates = {}
    config_updates = {}
    for key, value in updates.items():
        if key in SECRET_FIELDS:
            secret_updates[key] = value
        else:
            config_updates[key] = value

    # Write secrets
    for field, value in secret_updates.items():
        settings_base.write_secret(field, value, _fallback_write)

    # Write non-secret settings to Anki config
    config = mw.addonManager.getConfig(_addon_name) or {}
    if keyring_available():
        for field in SECRET_FIELDS:
            config.pop(field, None)
    config.update(config_updates)
    mw.addonManager.writeConfig(_addon_name, config)

    return get_settings()


def get_masked_settings():
    """Get settings with API keys masked."""
    return get_masked(get_settings())
