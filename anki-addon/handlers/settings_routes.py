"""Settings API handlers."""

import json

from ..server.web import Response
from ..services.settings_service import get_masked_settings, save_settings

_MASK_CHAR = "\u2022"
_MASK_PREFIX = _MASK_CHAR * 8


def handle_get_settings(_params, _headers, _body):
    try:
        settings = get_masked_settings()
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

    try:
        updated = save_settings(updates)
    except RuntimeError as e:
        return Response.error("Failed to update settings: {}".format(e))

    # Mask keys in response
    masked = dict(updated)
    for key in ("claudeApiKey", "geminiApiKey", "openRouterApiKey"):
        val = masked.get(key, "")
        if val:
            masked[key] = _MASK_PREFIX + val[-4:]
        else:
            masked[key] = ""

    return Response.json(masked)
