"""Settings management using Anki's add-on config + system keyring for secrets.

Non-secret settings stored in Anki's addon config (meta.json).
API keys and tokens stored in the system keyring (GNOME Keyring, KWallet, etc.)
with fallback to Anki's addon config if no keyring backend is available.
Defaults loaded from shared/defaults/settings.json.
"""

import json
import os

from aqt import mw

import keyring
import keyring.errors

# Probe whether a usable backend exists (not the fail.Keyring stub)
try:
    _backend = keyring.get_keyring()
    _KEYRING_AVAILABLE = not type(_backend).__name__.startswith("Fail")
except RuntimeError:
    _KEYRING_AVAILABLE = False

if not _KEYRING_AVAILABLE:
    print("[anki-defs] System keyring unavailable — secrets stored in Anki addon config")

# Packaged addon has _shared/ inside the addon dir; dev install uses repo-relative path.
# Resolve symlinks so dev installs (symlinked into Anki addons dir) find the repo.
_ADDON_DIR = os.path.realpath(os.path.dirname(os.path.dirname(__file__)))
_PACKAGED_PATH = os.path.join(_ADDON_DIR, "_shared", "defaults", "settings.json")
_REPO_PATH = os.path.join(os.path.dirname(_ADDON_DIR), "shared", "defaults", "settings.json")
_SHARED_DEFAULTS_PATH = _PACKAGED_PATH if os.path.isfile(_PACKAGED_PATH) else _REPO_PATH

_ADDON_DEFAULTS = {
    "port": 28735,
}

# Service name for keyring storage (shared with python-server)
_KEYRING_SERVICE = "anki-defs"

# Fields that contain secrets — stored in keyring when available, else in Anki config
_SECRET_FIELDS = ("claudeApiKey", "geminiApiKey", "openRouterApiKey", "apiToken")


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


def _read_secret(field):
    """Read a secret from keyring, falling back to Anki config."""
    if _KEYRING_AVAILABLE:
        try:
            value = keyring.get_password(_KEYRING_SERVICE, field)
            if value:
                return value
        except keyring.errors.KeyringError:
            pass
    # Fallback: read from Anki addon config
    config = mw.addonManager.getConfig(_addon_name) or {}
    return config.get(field, "")


def _write_secret(field, value):
    """Write a secret to keyring, falling back to Anki config."""
    if _KEYRING_AVAILABLE:
        try:
            if value:
                keyring.set_password(_KEYRING_SERVICE, field, value)
            else:
                try:
                    keyring.delete_password(_KEYRING_SERVICE, field)
                except keyring.errors.PasswordDeleteError:
                    pass
            return
        except keyring.errors.KeyringError:
            pass
    # Fallback: store in Anki addon config
    config = mw.addonManager.getConfig(_addon_name) or {}
    if value:
        config[field] = value
    else:
        config.pop(field, None)
    mw.addonManager.writeConfig(_addon_name, config)


def _get_secrets():
    """Read all secret fields from the keyring (or fallback)."""
    return {field: _read_secret(field) for field in _SECRET_FIELDS}


# __name__ resolves to the add-on package name when loaded by Anki
_addon_name = __name__.split(".")[0]


def get_settings():
    """Get current settings (defaults < anki config < secrets)."""
    config = mw.addonManager.getConfig(_addon_name) or {}
    # When using keyring, strip secrets from config (migration from plain text)
    if _KEYRING_AVAILABLE:
        for field in _SECRET_FIELDS:
            config.pop(field, None)
    result = _load_defaults()
    result.update(config)
    if _KEYRING_AVAILABLE:
        result.update(_get_secrets())
    # When not using keyring, secrets are already in config
    return result


def save_settings(updates):
    """Save partial settings update. Secrets go to keyring (or fallback), rest to Anki config."""
    secret_updates = {}
    config_updates = {}
    for key, value in updates.items():
        if key in _SECRET_FIELDS:
            secret_updates[key] = value
        else:
            config_updates[key] = value

    # Write secrets
    for field, value in secret_updates.items():
        _write_secret(field, value)

    # Write non-secret settings to Anki config
    config = mw.addonManager.getConfig(_addon_name) or {}
    if _KEYRING_AVAILABLE:
        for field in _SECRET_FIELDS:
            config.pop(field, None)
    config.update(config_updates)
    mw.addonManager.writeConfig(_addon_name, config)

    return get_settings()


def get_masked_settings():
    """Get settings with API keys masked."""
    settings = get_settings()
    masked = dict(settings)
    for key in ("claudeApiKey", "geminiApiKey", "openRouterApiKey"):
        val = masked.get(key, "")
        if val:
            masked[key] = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + val[-4:]
        else:
            masked[key] = ""
    return masked
