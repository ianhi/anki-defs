"""Settings routes — GET/PUT with masked API keys."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..services.ai import reset_clients
from ..services.settings import get_settings, mask_key, save_settings

router = APIRouter(prefix="/api/settings")


def _sanitize(settings: dict) -> dict:
    """Mask API keys for client display."""
    return {
        **settings,
        "claudeApiKey": mask_key(settings.get("claudeApiKey", "")),
        "geminiApiKey": mask_key(settings.get("geminiApiKey", "")),
        "openRouterApiKey": mask_key(settings.get("openRouterApiKey", "")),
    }


@router.get("")
async def get() -> JSONResponse:
    try:
        settings = get_settings()
        return JSONResponse(_sanitize(settings))
    except RuntimeError as e:
        print(f"[Settings] Error fetching settings: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.put("")
async def put(request: Request) -> JSONResponse:
    updates = await request.json()

    # If API keys are masked, don't update them
    if updates.get("claudeApiKey", "").startswith("\u2022\u2022\u2022\u2022"):
        del updates["claudeApiKey"]
    if updates.get("geminiApiKey", "").startswith("\u2022\u2022\u2022\u2022"):
        del updates["geminiApiKey"]
    if updates.get("openRouterApiKey", "").startswith("\u2022\u2022\u2022\u2022"):
        del updates["openRouterApiKey"]

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

    return JSONResponse(_sanitize(updated))
