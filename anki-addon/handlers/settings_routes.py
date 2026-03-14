"""Settings API handlers."""

import json

from ..server.web import Response
from ..services.settings_service import (
    get_masked_settings,
    has_insecure_consent,
    keyring_available,
    save_settings,
    set_insecure_consent,
)

_MASK_CHAR = "\u2022"


def handle_get_settings(_params, _headers, _body):
    try:
        settings = get_masked_settings()
        settings["_keyringAvailable"] = keyring_available()
        settings["_insecureStorageConsent"] = has_insecure_consent()
        return Response.json(settings)
    except RuntimeError as e:
        return Response.error("Failed to fetch settings: {}".format(e))


def handle_put_settings(_params, _headers, body):
    try:
        updates = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return Response.error("Invalid JSON", 400)

    # If API keys are masked (bullet chars), don't update them
    for key in ("claudeApiKey", "geminiApiKey", "openRouterApiKey"):
        val = updates.get(key, "")
        if isinstance(val, str) and val.startswith(_MASK_CHAR):
            del updates[key]

    # Handle insecure storage consent toggle
    consent_flag = updates.pop("_insecureStorageConsent", None)
    if consent_flag is not None:
        set_insecure_consent(bool(consent_flag))

    # Check if saving secrets without keyring — require consent (once)
    has_secrets = any(
        key in updates and updates[key]
        for key in ("claudeApiKey", "geminiApiKey", "openRouterApiKey")
    )
    if has_secrets and not keyring_available() and not has_insecure_consent():
        return Response.error(
            "No system keyring available. API keys would be stored in plain text "
            "in Anki's addon config. Confirm to proceed.",
            409,
        )

    try:
        save_settings(updates)
    except RuntimeError as e:
        return Response.error("Failed to update settings: {}".format(e))

    result = get_masked_settings()
    result["_keyringAvailable"] = keyring_available()
    result["_insecureStorageConsent"] = has_insecure_consent()
    return Response.json(result)
