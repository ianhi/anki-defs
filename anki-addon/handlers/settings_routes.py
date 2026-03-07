"""Settings API handlers."""

import json
from ..server.web import Response
from ..services.settings_service import get_masked_settings, save_settings, get_settings


def handle_get_settings(_params, _headers, _body):
    try:
        settings = get_masked_settings()
        return Response.json(settings)
    except Exception as e:
        return Response.error("Failed to fetch settings: {}".format(e))


def handle_put_settings(_params, _headers, body):
    try:
        updates = json.loads(body) if body else {}

        # If API keys are masked, don't update them
        for key in ("claudeApiKey", "geminiApiKey", "openRouterApiKey"):
            val = updates.get(key, "")
            if isinstance(val, str) and val.startswith("----"):
                del updates[key]

        updated = save_settings(updates)

        # Mask keys in response
        masked = dict(updated)
        for key in ("claudeApiKey", "geminiApiKey", "openRouterApiKey"):
            val = masked.get(key, "")
            if val:
                masked[key] = "--------" + val[-4:]
            else:
                masked[key] = ""

        return Response.json(masked)
    except Exception as e:
        return Response.error("Failed to update settings: {}".format(e))
