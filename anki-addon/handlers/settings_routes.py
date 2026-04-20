"""Settings API routes."""

import logging

from anki_defs.services.settings_service import (
    get_masked_settings,
    has_insecure_consent,
    has_new_secrets,
    keyring_available,
    save_settings,
    set_insecure_consent,
    strip_masked_keys,
)
from bottle import request, response

log = logging.getLogger(__name__)


def _response_settings():
    """Get masked settings with keyring metadata."""
    result = get_masked_settings()
    result["_keyringAvailable"] = keyring_available()
    result["_insecureStorageConsent"] = has_insecure_consent()
    return result


def register(app):
    @app.get("/api/settings")
    def get_settings():
        try:
            return _response_settings()
        except RuntimeError as e:
            log.error("Error fetching settings: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.put("/api/settings")
    def put_settings():
        updates = request.json or {}

        updates = strip_masked_keys(updates)

        consent_flag = updates.pop("_insecureStorageConsent", None)
        if consent_flag is not None:
            set_insecure_consent(bool(consent_flag))

        if has_new_secrets(updates) and not keyring_available() and not has_insecure_consent():
            response.status = 409
            return {
                "error": "No system keyring available. API keys would be stored in plain text "
                "in Anki's addon config. Confirm to proceed."
            }

        try:
            save_settings(updates)
        except RuntimeError as e:
            log.error("Error updating settings: %s", e)
            response.status = 500
            return {"error": str(e)}

        if any(
            key in updates
            for key in ("aiProvider", "claudeApiKey", "geminiApiKey", "openRouterApiKey")
        ):
            from anki_defs._services import ai as ai_service

            ai_service.reset_clients()

        return _response_settings()
