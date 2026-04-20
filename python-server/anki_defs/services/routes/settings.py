"""Settings routes — GET/PUT with masked API keys and keyring consent."""

from __future__ import annotations

import logging
from typing import Any

from bottle import request, response

from .. import ai
from ..settings import (
    get_settings,
    has_insecure_consent,
    keyring_available,
    save_settings,
    set_insecure_consent,
)
from ..settings_base import get_masked, has_new_secrets, strip_masked_keys

log = logging.getLogger(__name__)


def _response_settings(settings: dict) -> dict:
    """Mask keys and add keyring metadata to settings response."""
    result = get_masked(settings)
    result["_keyringAvailable"] = keyring_available()
    result["_insecureStorageConsent"] = has_insecure_consent()
    return result


def register(app: Any) -> None:
    @app.get("/api/settings")
    def get() -> dict:
        try:
            settings = get_settings()
            return _response_settings(settings)
        except RuntimeError as e:
            log.error("Error fetching settings: %s", e)
            response.status = 500
            return {"error": str(e)}

    @app.put("/api/settings")
    def put() -> dict:
        updates = request.json or {}

        updates = strip_masked_keys(updates)

        consent_flag = updates.pop("_insecureStorageConsent", None)
        if consent_flag is not None:
            set_insecure_consent(bool(consent_flag))

        if (
            has_new_secrets(updates)
            and not keyring_available()
            and not has_insecure_consent()
        ):
            response.status = 409
            return {
                "error": (
                    "No system keyring available. API keys would be stored"
                    " in plain text in the settings file. Confirm to proceed."
                )
            }

        try:
            updated = save_settings(updates)
        except RuntimeError as e:
            log.error("Error updating settings: %s", e)
            response.status = 500
            return {"error": str(e)}

        if any(
            k in updates
            for k in (
                "aiProvider",
                "claudeApiKey",
                "geminiApiKey",
                "openRouterApiKey",
            )
        ):
            ai.reset_clients()

        return _response_settings(updated)
