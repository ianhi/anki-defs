"""Shared helpers for route modules — SSE, cost computation, error formatting."""

from __future__ import annotations

import json
import logging
import queue
import threading
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx

from ...config import DATA_DIR
from .. import ai, card_extraction, session

log = logging.getLogger(__name__)

with open(DATA_DIR / "model-pricing.json", encoding="utf-8") as _f:
    MODEL_PRICING: dict[str, dict[str, float]] = json.load(_f)

# Bidirectional MIME <-> extension mapping
_EXT_TO_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}
MIME_TO_EXT = {v: k for k, v in _EXT_TO_MIME.items() if k != ".jpeg"}


def ext_to_mime(ext: str) -> str:
    return _EXT_TO_MIME.get(ext.lower(), "image/jpeg")


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


def check_words_parallel(
    anki: Any, words: list[str], target_deck: str,
) -> dict[str, Any | None]:
    """Search Anki for multiple words concurrently."""
    results: dict[str, Any | None] = {}

    def _check(word: str) -> None:
        try:
            results[word] = anki.search_word(word, target_deck)
        except (RuntimeError, ValueError, httpx.HTTPError) as e:
            log.error("Anki search failed for %s: %s", word, e)
            results[word] = None

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda w: _check(w), words))
    return results


def parse_cards_with_healing(
    raw: str,
    usage_cb: Callable[[dict[str, Any]], None] | None = None,
) -> list[dict[str, Any]]:
    """Parse AI JSON response into card dicts, retrying with a healing prompt on failure.

    ``usage_cb`` is called with the retry usage dict if a healing retry occurs.
    Raises ``ValueError`` if both attempts fail.
    """
    try:
        parsed = ai.parse_json_response(raw)
        return card_extraction.validate_card_responses(parsed)
    except (json.JSONDecodeError, ValueError):
        log.warning("JSON parse failed, retrying with healing prompt")
        retry = ai.get_json_completion(
            "Fix the following malformed JSON. "
            "Return ONLY valid JSON, nothing else.",
            raw,
        )
        retry_usage = retry.get("usage")
        if retry_usage:
            cost = compute_cost(retry_usage)
            session.record_usage(retry_usage, cost)
            if usage_cb:
                usage_cb(retry_usage)
        parsed = ai.parse_json_response(retry.get("text", ""))
        return card_extraction.validate_card_responses(parsed)


def sse_stream(
    response_obj: Any,
    worker_fn: Callable[[queue.Queue[str | None]], None],
) -> Iterator[str]:
    """Run ``worker_fn`` in a daemon thread, streaming SSE events via a queue."""
    response_obj.content_type = "text/event-stream"
    response_obj.set_header("Cache-Control", "no-cache")

    q: queue.Queue[str | None] = queue.Queue()

    def _wrapper() -> None:
        try:
            worker_fn(q)
        finally:
            q.put(None)

    threading.Thread(target=_wrapper, daemon=True).start()

    def _generate() -> Iterator[str]:
        while True:
            item = q.get()
            if item is None:
                break
            yield item

    return _generate()
