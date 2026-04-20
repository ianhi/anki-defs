"""Shared helpers for route modules — SSE, cost computation, error formatting."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ...config import DATA_DIR

with open(DATA_DIR / "model-pricing.json", encoding="utf-8") as _f:
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
            hint = (
                " \u2014 the request was rejected"
                " (bad model name or invalid API key)."
            )
        return f"AI provider returned HTTP {status}{hint}\n\n{detail}"
    return f"Network error talking to the AI provider: {exc}"


def strip_article(word: str, language: dict[str, Any]) -> str | None:
    """Strip a leading article/particle, return stripped form or None."""
    particles_str = (
        language.get("sentenceAnalysis", {}).get("skipParticles", "")
    )
    if not particles_str:
        return None
    particles = [p.strip().lower() for p in particles_str.split(",")][:20]
    lower = word.lower()
    for p in particles:
        prefix = p + " "
        if lower.startswith(prefix) and len(word) > len(prefix):
            return word[len(prefix):]
    return None
