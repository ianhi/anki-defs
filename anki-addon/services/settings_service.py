"""Settings management using Anki's add-on config + system keyring for secrets.

Non-secret settings stored in Anki's addon config (meta.json).
API keys and tokens stored in the system keyring (GNOME Keyring, KWallet, etc.).
Falls back to Anki addon config if no keyring backend is available, but only
with explicit user consent (the API exposes keyring status so the frontend
can warn the user).
Defaults loaded from shared/defaults/settings.json.
"""

import json
import os

import keyring
import keyring.errors
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

# Service name for keyring storage (shared with python-server)
_KEYRING_SERVICE = "anki-defs"

# Fields that contain secrets — stored in keyring, never in Anki config
_SECRET_FIELDS = ("claudeApiKey", "geminiApiKey", "openRouterApiKey", "apiToken")

# Probe whether a usable keyring backend exists by doing a real read test
_KEYRING_AVAILABLE = False
try:
    _backend = keyring.get_keyring()
    _backend_name = type(_backend).__name__
    if not _backend_name.startswith("Fail"):
        # Actually test that the backend works (priority check alone is not enough)
        keyring.get_password(_KEYRING_SERVICE, "_probe")
        _KEYRING_AVAILABLE = True
except (RuntimeError, keyring.errors.KeyringError):
    pass

if _KEYRING_AVAILABLE:
    print("[anki-defs] Keyring backend: {}".format(type(keyring.get_keyring()).__name__))
else:
    print("[anki-defs] No system keyring available — API keys will require user consent to store")

# __name__ resolves to the add-on package name when loaded by Anki
_addon_name = __name__.split(".")[0]


def keyring_available():
    """Return whether a secure keyring backend is available."""
    return _KEYRING_AVAILABLE


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
    """Read a secret from the system keyring, or from addon config as fallback."""
    if _KEYRING_AVAILABLE:
        try:
            value = keyring.get_password(_KEYRING_SERVICE, field)
            if value:
                return value
        except keyring.errors.KeyringError:
            pass
    # Fallback: read from Anki addon config (user previously consented)
    config = mw.addonManager.getConfig(_addon_name) or {}
    return config.get(field, "")


def _write_secret(field, value):
    """Write a secret to the system keyring, or to addon config as fallback."""
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
    # Fallback: store in Anki addon config (caller must have user consent)
    config = mw.addonManager.getConfig(_addon_name) or {}
    if value:
        config[field] = value
    else:
        config.pop(field, None)
    mw.addonManager.writeConfig(_addon_name, config)


def _get_secrets():
    """Read all secret fields."""
    return {field: _read_secret(field) for field in _SECRET_FIELDS}


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


def get_settings():
    """Get current settings (defaults < anki config < secrets)."""
    config = mw.addonManager.getConfig(_addon_name) or {}
    # When using keyring, strip secrets from config (migration from plain text)
    if _KEYRING_AVAILABLE:
        for field in _SECRET_FIELDS:
            config.pop(field, None)
    result = _load_defaults()
    result.update(config)
    result.update(_get_secrets())
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
