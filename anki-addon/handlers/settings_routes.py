"""Settings API handlers."""

import json

from ..server.web import Response
from ..services.settings_service import (
    get_masked_settings,
    has_insecure_consent,
    has_new_secrets,
    keyring_available,
    save_settings,
    set_insecure_consent,
    strip_masked_keys,
)


def _response_settings():
    """Get masked settings with keyring metadata."""
    result = get_masked_settings()
    result["_keyringAvailable"] = keyring_available()
    result["_insecureStorageConsent"] = has_insecure_consent()
    return result


def handle_get_settings(_params, _headers, _body):
    try:
        return Response.json(_response_settings())
    except RuntimeError as e:
        return Response.error("Failed to fetch settings: {}".format(e))


def handle_put_settings(_params, _headers, body):
    try:
        updates = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return Response.error("Invalid JSON", 400)

    # Strip masked keys (they haven't changed)
    updates = strip_masked_keys(updates)

    # Handle insecure storage consent toggle
    consent_flag = updates.pop("_insecureStorageConsent", None)
    if consent_flag is not None:
        set_insecure_consent(bool(consent_flag))

    # Check if saving secrets without keyring — require consent (once)
    if has_new_secrets(updates) and not keyring_available() and not has_insecure_consent():
        return Response.error(
            "No system keyring available. API keys would be stored in plain text "
            "in Anki's addon config. Confirm to proceed.",
            409,
        )

    try:
        save_settings(updates)
    except RuntimeError as e:
        return Response.error("Failed to update settings: {}".format(e))

    return Response.json(_response_settings())
