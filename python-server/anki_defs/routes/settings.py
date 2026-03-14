"""Settings routes — GET/PUT with masked API keys and keyring consent."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..services.ai import reset_clients
from ..services.settings import (
    get_masked,
    get_settings,
    has_insecure_consent,
    has_new_secrets,
    keyring_available,
    save_settings,
    set_insecure_consent,
    strip_masked_keys,
)

router = APIRouter(prefix="/api/settings")


def _response_settings(settings: dict) -> dict:
    """Mask keys and add keyring metadata to settings response."""
    result = get_masked(settings)
    result["_keyringAvailable"] = keyring_available()
    result["_insecureStorageConsent"] = has_insecure_consent()
    return result


@router.get("")
async def get() -> JSONResponse:
    try:
        settings = get_settings()
        return JSONResponse(_response_settings(settings))
    except RuntimeError as e:
        print(f"[Settings] Error fetching settings: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.put("")
async def put(request: Request) -> JSONResponse:
    updates = await request.json()

    # Strip masked keys (they haven't changed)
    updates = strip_masked_keys(updates)

    # Handle insecure storage consent toggle
    consent_flag = updates.pop("_insecureStorageConsent", None)
    if consent_flag is not None:
        set_insecure_consent(bool(consent_flag))

    # Check if saving secrets without keyring — require consent (once)
    if has_new_secrets(updates) and not keyring_available() and not has_insecure_consent():
        return JSONResponse(
            {
                "error": "No system keyring available. API keys would be stored in plain text "
                "in the settings file. Confirm to proceed."
            },
            status_code=409,
        )

    try:
        updated = save_settings(updates)
    except RuntimeError as e:
        print(f"[Settings] Error updating settings: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

    # Reset AI clients if provider or keys changed
    if any(
        k in updates
        for k in ("aiProvider", "claudeApiKey", "geminiApiKey", "openRouterApiKey")
    ):
        reset_clients()

    return JSONResponse(_response_settings(updated))
