"""Shared helpers for SSE route modules."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ..config import SHARED_DIR

with open(SHARED_DIR / "data" / "model-pricing.json", encoding="utf-8") as _f:
    MODEL_PRICING: dict[str, dict[str, float]] = json.load(_f)


def compute_cost(usage: dict[str, Any]) -> float:
    model = usage.get("model", "")
    pricing = MODEL_PRICING.get(model)
    if not pricing:
        return 0.0
    return (
        usage.get("inputTokens", 0) * pricing["input"]
        + usage.get("outputTokens", 0) * pricing["output"]
    ) / 1_000_000


def sse_event(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"


def format_http_error(exc: httpx.HTTPError) -> str:
    """Format an httpx error into a user-facing message with contextual hints."""
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        detail = (exc.response.text or "").strip()
        try:
            data = exc.response.json()
            if isinstance(data, dict):
                err = data.get("error")
                if isinstance(err, dict) and err.get("message"):
                    detail = err["message"]
                elif isinstance(err, str):
                    detail = err
        except (ValueError, json.JSONDecodeError):
            pass
        if len(detail) > 500:
            detail = detail[:500] + "\u2026"
        hint = ""
        if status in (401, 403):
            hint = " \u2014 check your API key in Settings."
        elif status == 429:
            hint = " \u2014 rate limited; wait a moment or check your plan."
        elif status == 400:
            hint = " \u2014 the request was rejected (bad model name or invalid API key)."
        return f"AI provider returned HTTP {status}{hint}\n\n{detail}"
    return f"Network error talking to the AI provider: {exc}"
