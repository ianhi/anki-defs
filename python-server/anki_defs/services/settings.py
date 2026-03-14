"""File-based settings with env var overrides. Matches Express settings.ts."""

from __future__ import annotations

import json
import os
import stat
from typing import Any

from ..config import CONFIG_DIR, DEFAULTS_DIR, SETTINGS_FILE

# Load defaults from shared/defaults/settings.json
_defaults: dict[str, Any] | None = None


def _get_defaults() -> dict[str, Any]:
    global _defaults
    if _defaults is None:
        defaults_file = DEFAULTS_DIR / "settings.json"
        with open(defaults_file, encoding="utf-8") as f:
            _defaults = json.load(f)
    return dict(_defaults)  # type: ignore[arg-type]


def _get_env_overrides() -> dict[str, Any]:
    """Environment variable keys override file-based settings."""
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


def get_settings() -> dict[str, Any]:
    """Get merged settings: defaults < file < env overrides."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    file_settings: dict[str, Any] = {}
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, encoding="utf-8") as f:
                file_settings = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"[Settings] Error reading settings: {e}")

    result = {**_get_defaults(), **file_settings, **_get_env_overrides()}
    return result


def save_settings(updates: dict[str, Any]) -> dict[str, Any]:
    """Save settings updates to file. Returns merged settings with env overrides."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    file_settings: dict[str, Any] = {}
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, encoding="utf-8") as f:
                file_settings = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass

    updated = {**file_settings, **updates}
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(updated, f, indent=2)
    os.chmod(SETTINGS_FILE, stat.S_IRUSR | stat.S_IWUSR)

    return {**_get_defaults(), **updated, **_get_env_overrides()}


def mask_key(key: str) -> str:
    """Mask an API key for display (show last 4 chars)."""
    if not key:
        return ""
    return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + key[-4:]
