"""Shared keyring/consent/masking logic for settings — platform-agnostic.

Both python-server and anki-addon import from this module. Platform-specific
storage (JSON file vs Anki config) is handled via fallback callbacks passed
by each adapter.

This module MUST NOT import aqt, fastapi, or any platform-specific packages.
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any, Callable

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

KEYRING_SERVICE = "anki-defs"

SECRET_FIELDS = ("claudeApiKey", "geminiApiKey", "openRouterApiKey", "apiToken")

# API key fields shown to users (excludes apiToken which is internal)
VISIBLE_SECRET_FIELDS = ("claudeApiKey", "geminiApiKey", "openRouterApiKey")

MASK_CHAR = "\u2022"
_MASK_PREFIX = MASK_CHAR * 8

# ---------------------------------------------------------------------------
# D-Bus environment fix
# ---------------------------------------------------------------------------


def ensure_dbus() -> None:
    """Set DBUS_SESSION_BUS_ADDRESS if missing on Linux.

    Desktop sessions always have the D-Bus socket at /run/user/<uid>/bus but
    some environments (SSH, cron, systemd services, Anki's embedded Python)
    don't export the env var. The keyring SecretService backend needs it.
    """
    if sys.platform != "linux":
        return
    if os.environ.get("DBUS_SESSION_BUS_ADDRESS"):
        return
    bus = f"/run/user/{os.getuid()}/bus"
    if os.path.exists(bus):
        os.environ["DBUS_SESSION_BUS_ADDRESS"] = f"unix:path={bus}"


# Run before keyring is used
ensure_dbus()

# Now import keyring (after D-Bus is set up)
import keyring  # noqa: E402
import keyring.errors  # noqa: E402

# ---------------------------------------------------------------------------
# Keyring probe
# ---------------------------------------------------------------------------

_keyring_available: bool = False


def _probe_keyring() -> bool:
    """Test whether a usable keyring backend exists by doing a real read."""
    try:
        backend = keyring.get_keyring()
        if type(backend).__name__.startswith("Fail"):
            return False
        # Actually test that the backend works
        keyring.get_password(KEYRING_SERVICE, "_probe")
        return True
    except (RuntimeError, keyring.errors.KeyringError):
        return False


_keyring_available = _probe_keyring()

if _keyring_available:
    log.info("Keyring backend: %s", type(keyring.get_keyring()).__name__)
else:
    log.info("No system keyring — will use fallback storage")

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def keyring_available() -> bool:
    """Return whether a secure keyring backend is available."""
    return _keyring_available


def read_secret(field: str, fallback_read: Callable[[str], str]) -> str:
    """Read a secret from keyring, falling back to platform storage.

    Args:
        field: The secret field name (e.g. "geminiApiKey")
        fallback_read: Platform callback that reads a field from config storage
    """
    if _keyring_available:
        try:
            value = keyring.get_password(KEYRING_SERVICE, field)
            if value:
                return value
        except keyring.errors.KeyringError:
            pass
    return fallback_read(field)


def write_secret(
    field: str, value: str, fallback_write: Callable[[str, str], None]
) -> None:
    """Write a secret to keyring, falling back to platform storage.

    Args:
        field: The secret field name
        value: The value to store (empty string to delete)
        fallback_write: Platform callback that writes a field to config storage
    """
    if _keyring_available:
        try:
            if value:
                keyring.set_password(KEYRING_SERVICE, field, value)
            else:
                try:
                    keyring.delete_password(KEYRING_SERVICE, field)
                except keyring.errors.PasswordDeleteError:
                    pass
            return
        except keyring.errors.KeyringError:
            pass
    fallback_write(field, value)


def get_secrets(fallback_read: Callable[[str], str]) -> dict[str, str]:
    """Read all secret fields."""
    return {field: read_secret(field, fallback_read) for field in SECRET_FIELDS}


def mask_key(key: str) -> str:
    """Mask an API key for display (show last 4 chars)."""
    if not key:
        return ""
    return _MASK_PREFIX + key[-4:]


def is_masked(value: str) -> bool:
    """Check if a value is a masked key (starts with mask character)."""
    return isinstance(value, str) and value.startswith(MASK_CHAR)


def get_masked(settings: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of settings with API keys masked."""
    masked = dict(settings)
    for key in VISIBLE_SECRET_FIELDS:
        val = masked.get(key, "")
        masked[key] = mask_key(val) if val else ""
    return masked


def has_new_secrets(updates: dict[str, Any]) -> bool:
    """Check if updates contain non-empty API key values."""
    return any(
        key in updates and updates[key] for key in VISIBLE_SECRET_FIELDS
    )


def strip_masked_keys(updates: dict[str, Any]) -> dict[str, Any]:
    """Remove masked API key values from updates (they haven't changed)."""
    result = dict(updates)
    for key in VISIBLE_SECRET_FIELDS:
        val = result.get(key, "")
        if is_masked(val):
            del result[key]
    return result
