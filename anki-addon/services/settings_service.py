"""Settings management using Anki's add-on config system."""

from aqt import mw

DEFAULT_SETTINGS = {
    "aiProvider": "claude",
    "claudeApiKey": "",
    "geminiApiKey": "",
    "geminiModel": "gemini-2.5-flash-lite",
    "openRouterApiKey": "",
    "openRouterModel": "google/gemini-2.5-flash",
    "showTransliteration": False,
    "defaultDeck": "Bangla",
    "defaultModel": "Bangla (and reversed)",
    "ankiConnectUrl": "http://localhost:8765",
    "fieldMapping": {
        "Word": "Bangla",
        "Definition": "Eng_trans",
        "Example": "example sentence",
        "Translation": "sentence-trans",
    },
    "port": 28735,
}

# __name__ resolves to the add-on package name when loaded by Anki
_addon_name = __name__.split(".")[0]


def get_settings():
    """Get current settings (merged with defaults)."""
    config = mw.addonManager.getConfig(_addon_name) or {}
    result = dict(DEFAULT_SETTINGS)
    result.update(config)
    return result


def save_settings(updates):
    """Save partial settings update. Returns the full merged settings."""
    config = mw.addonManager.getConfig(_addon_name) or {}
    config.update(updates)
    mw.addonManager.writeConfig(_addon_name, config)
    result = dict(DEFAULT_SETTINGS)
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
