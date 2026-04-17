"""File-based settings with API keys stored in system keyring.

Platform adapter for python-server: stores non-secret settings in a JSON file
at ~/.config/anki-defs/settings.json, secrets in the system keyring (with
fallback to the JSON file if keyring is unavailable).
"""

from __future__ import annotations

import json
import logging
import os
import stat
from typing import Any

from ..config import CONFIG_DIR, DEFAULTS_DIR, SETTINGS_FILE
from . import settings_base
from .settings_base import (
    SECRET_FIELDS,
    _migrate_settings,
    get_masked,
    get_secrets,
    has_new_secrets,
    is_masked,
    keyring_available,
    mask_key,
    strip_masked_keys,
)

log = logging.getLogger(__name__)

# Re-export for consumers
__all__ = [
    "get_settings",
    "save_settings",
    "mask_key",
    "get_masked",
    "keyring_available",
    "has_insecure_consent",
    "set_insecure_consent",
    "has_new_secrets",
    "is_masked",
    "strip_masked_keys",
]

# Load defaults from shared/defaults/settings.json
_defaults: dict[str, Any] | None = None

# Cached file settings (before env/keyring overrides) + mtime for invalidation
_cached_file_settings: dict[str, Any] | None = None
_cached_mtime: float = 0


def _get_defaults() -> dict[str, Any]:
    global _defaults
    if _defaults is None:
        defaults_file = DEFAULTS_DIR / "settings.json"
        with open(defaults_file, encoding="utf-8") as f:
            _defaults = json.load(f)
    return dict(_defaults)  # type: ignore[arg-type]


def _get_env_overrides() -> dict[str, Any]:
    """Environment variable keys override all other sources."""
    overrides: dict[str, Any] = {}

    if os.environ.get("ANTHROPIC_API_KEY"):
        overrides["claudeApiKey"] = os.environ["ANTHROPIC_API_KEY"]
    if os.environ.get("CLAUDE_API_KEY"):
        overrides["claudeApiKey"] = os.environ["CLAUDE_API_KEY"]
    if os.environ.get("GEMINI_API_KEY"):
        overrides["geminiApiKey"] = os.environ["GEMINI_API_KEY"]
    if os.environ.get("GOOGLE_API_KEY"):
        overrides["geminiApiKey"] = os.environ["GOOGLE_API_KEY"]
    if os.environ.get("GEMINI_MODEL"):
        overrides["geminiModel"] = os.environ["GEMINI_MODEL"]
    if os.environ.get("OPENROUTER_API_KEY"):
        overrides["openRouterApiKey"] = os.environ["OPENROUTER_API_KEY"]
    if os.environ.get("OPENROUTER_MODEL"):
        overrides["openRouterModel"] = os.environ["OPENROUTER_MODEL"]
    if os.environ.get("AI_PROVIDER"):
        provider = os.environ["AI_PROVIDER"].lower()
        if provider in ("claude", "gemini", "openrouter"):
            overrides["aiProvider"] = provider
    if os.environ.get("DEFAULT_DECK"):
        overrides["defaultDeck"] = os.environ["DEFAULT_DECK"]

    return overrides


# ---------------------------------------------------------------------------
# Fallback callbacks (used when keyring is unavailable)
# ---------------------------------------------------------------------------


def _fallback_read(field: str) -> str:
    """Read a secret from the settings JSON file."""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, encoding="utf-8") as f:
                data = json.load(f)
                return data.get(field, "")
        except (json.JSONDecodeError, OSError):
            pass
    return ""


def _fallback_write(field: str, value: str) -> None:
    """Write a secret to the settings JSON file."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    file_settings: dict = {}
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, encoding="utf-8") as f:
                file_settings = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    if value:
        file_settings[field] = value
    else:
        file_settings.pop(field, None)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(file_settings, f, indent=2)
    os.chmod(SETTINGS_FILE, stat.S_IRUSR | stat.S_IWUSR)


# ---------------------------------------------------------------------------
# Consent tracking (stored in the settings file)
# ---------------------------------------------------------------------------


def has_insecure_consent() -> bool:
    """Check if user previously consented to insecure (plain text) storage."""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, encoding="utf-8") as f:
                data = json.load(f)
                return data.get("_insecureStorageConsent", False)
        except (json.JSONDecodeError, OSError):
            pass
    return False


def set_insecure_consent(value: bool) -> None:
    """Store the user's consent for insecure storage."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    file_settings: dict = {}
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, encoding="utf-8") as f:
                file_settings = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    if value:
        file_settings["_insecureStorageConsent"] = True
    else:
        file_settings.pop("_insecureStorageConsent", None)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(file_settings, f, indent=2)
    os.chmod(SETTINGS_FILE, stat.S_IRUSR | stat.S_IWUSR)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_settings() -> dict[str, Any]:
    """Get merged settings: defaults < file < keyring secrets < env overrides."""
    global _cached_file_settings, _cached_mtime

    try:
        mtime = SETTINGS_FILE.stat().st_mtime
    except OSError:
        mtime = 0

    if _cached_file_settings is None or mtime != _cached_mtime:
        file_settings: dict[str, Any] = {}
        if mtime > 0:
            try:
                with open(SETTINGS_FILE, encoding="utf-8") as f:
                    file_settings = json.load(f)
            except (json.JSONDecodeError, OSError) as e:
                log.error("Error reading settings: %s", e)
        # Strip secrets that may have leaked into the file (migration)
        if keyring_available():
            for field in SECRET_FIELDS:
                file_settings.pop(field, None)
        # Migrate legacy setting names
        file_settings = _migrate_settings(file_settings)
        _cached_file_settings = {**_get_defaults(), **file_settings}
        _cached_mtime = mtime

    return {
        **_cached_file_settings,
        **get_secrets(_fallback_read),
        **_get_env_overrides(),
    }


def save_settings(updates: dict[str, Any]) -> dict[str, Any]:
    """Save settings. Secrets go to keyring, everything else to JSON file."""
    global _cached_file_settings, _cached_mtime

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    # Separate secrets from non-secret settings
    secret_updates: dict[str, str] = {}
    file_updates: dict[str, Any] = {}
    for key, value in updates.items():
        if key in SECRET_FIELDS:
            secret_updates[key] = value
        else:
            file_updates[key] = value

    # Write secrets
    for field, value in secret_updates.items():
        settings_base.write_secret(field, value, _fallback_write)

    # Write non-secret settings to file
    file_settings: dict[str, Any] = {}
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, encoding="utf-8") as f:
                file_settings = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass

    # Strip secrets from the file (migration cleanup)
    if keyring_available():
        for field in SECRET_FIELDS:
            file_settings.pop(field, None)

    file_settings.update(file_updates)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(file_settings, f, indent=2)
    os.chmod(SETTINGS_FILE, stat.S_IRUSR | stat.S_IWUSR)

    _cached_file_settings = {**_get_defaults(), **file_settings}
    _cached_mtime = SETTINGS_FILE.stat().st_mtime
    return {
        **_cached_file_settings,
        **get_secrets(_fallback_read),
        **_get_env_overrides(),
    }
