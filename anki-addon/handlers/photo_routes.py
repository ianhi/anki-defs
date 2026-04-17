"""Photo routes — extract vocab pairs from images and batch-generate cards.

Mirrors python-server/anki_defs/routes/photo.py but uses anki_service
(direct Anki API) instead of anki_connect (HTTP to AnkiConnect).
"""

import base64
import json
import logging
import queue
import threading
from concurrent.futures import ThreadPoolExecutor

import httpx
from bottle import request, response

from ..server.sse import format_sse_event
from ..services import ai_service, anki_service
from ..services.card_extraction import build_card_previews, validate_card_responses
from ..services.session_service import record_usage
from ..services.settings_service import get_settings

log = logging.getLogger(__name__)

# Pricing for cost estimation
try:
    import os

    _pricing_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "_shared", "data", "model-pricing.json",
    )
    with open(_pricing_path, encoding="utf-8") as _f:
        _MODEL_PRICING = json.load(_f)
except (OSError, json.JSONDecodeError):
    _MODEL_PRICING = {}


def _compute_cost(usage):
    model = usage.get("model", "")
    pricing = _MODEL_PRICING.get(model)
    if not pricing:
        return 0.0
    return (
        usage.get("inputTokens", 0) * pricing["input"]
        + usage.get("outputTokens", 0) * pricing["output"]
    ) / 1_000_000


def _sse(event_type, data):
    return format_sse_event(event_type, data)


def _format_http_error(exc):
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
        return "AI provider returned HTTP {}{}\\n\\n{}".format(status, hint, detail)
    return "Network error talking to the AI provider: {}".format(exc)


def _strip_article(word, language):
    """Strip a leading article/particle from a word, return stripped form or None."""
    particles_str = language.get("sentenceAnalysis", {}).get("skipParticles", "")
    if not particles_str:
        return None
    particles = [p.strip().lower() for p in particles_str.split(",")][:20]
    lower = word.lower()
    for p in particles:
        prefix = p + " "
        if lower.startswith(prefix) and len(word) > len(prefix):
            return word[len(prefix):]
    return None


def register(app):
    @app.post("/api/photo/extract")
    def extract():
        upload = request.files.get("image")
        deck = request.forms.get("deck", "")
        if not upload:
            response.status = 400
            return {"error": "image file is required"}

        image_base64 = base64.b64encode(upload.file.read()).decode()
        mime_type = upload.content_type or "image/jpeg"

        try:
            ai_service.reload_prompts()
            result = ai_service.get_vision_extraction(image_base64, mime_type)
            usage = result.get("usage")
            if usage:
                cost = _compute_cost(usage)
                record_usage(usage, cost)

            pairs = result["pairs"]
            if deck and pairs:
                settings = get_settings()
                target_deck = deck or settings.get("defaultDeck", "Bangla")
                language = ai_service.get_language_for_deck(target_deck)
                for pair in pairs:
                    word = pair.get("word", "")
                    if not word:
                        continue
                    try:
                        existing = anki_service.search_word(word, target_deck)
                        if existing is None:
                            stripped = _strip_article(word, language)
                            if stripped:
                                existing = anki_service.search_word(
                                    stripped, target_deck
                                )
                        if existing is not None:
                            pair["alreadyExists"] = True
                            fields = existing.get("fields", {})
                            for fname in ("Definition", "Definitions 1", "Back"):
                                val = fields.get(fname, {}).get("value", "")
                                if val:
                                    pair["existingDefinition"] = val
                                    break
                    except (RuntimeError, ValueError):
                        pass

            return {"pairs": pairs, "usage": usage}
        except httpx.HTTPStatusError as e:
            log.error("Photo extract HTTP error: %s", e)
            response.status = e.response.status_code
            return {"error": _format_http_error(e)}
        except (httpx.HTTPError, ValueError, OSError) as e:
            log.error("Photo extract error: %s", e, exc_info=True)
            response.status = 500
            return {"error": "Failed to extract vocab from image: {}".format(e)}

    @app.post("/api/photo/generate")
    def generate():
        body = request.json or {}
        pairs = body.get("pairs", [])
        deck = body.get("deck")

        if not pairs:
            response.status = 400
            return iter([_sse("error", "pairs is required")])

        response.content_type = "text/event-stream"
        response.set_header("Cache-Control", "no-cache")

        q = queue.Queue()
        CHUNK_SIZE = 5

        def _process_chunk(chunk, target_deck, language, transliteration):
            try:
                system_prompt, user_message = ai_service.build_photo_generate_prompt(
                    chunk, language, transliteration
                )
                result = ai_service.get_json_completion(system_prompt, user_message)
                raw = result.get("text", "")
                usage = result.get("usage")

                if usage:
                    cost = _compute_cost(usage)
                    record_usage(usage, cost)
                    q.put(_sse("usage", usage))

                try:
                    parsed = ai_service.parse_json_response(raw)
                    cards = validate_card_responses(parsed)
                except (json.JSONDecodeError, ValueError):
                    log.warning("JSON parse failed for chunk, retrying")
                    retry = ai_service.get_json_completion(
                        "Fix the following malformed JSON. Return ONLY valid JSON.",
                        raw,
                    )
                    retry_usage = retry.get("usage")
                    if retry_usage:
                        cost = _compute_cost(retry_usage)
                        record_usage(retry_usage, cost)
                        q.put(_sse("usage", retry_usage))
                    parsed = ai_service.parse_json_response(retry.get("text", ""))
                    cards = validate_card_responses(parsed)

                # Check Anki for duplicates
                anki_results = {}
                for c in cards:
                    w = c.get("word", "")
                    if w:
                        try:
                            note = anki_service.search_word(w, target_deck)
                            if note:
                                anki_results[w] = note
                        except (RuntimeError, ValueError):
                            pass

                previews = build_card_previews(cards, target_deck, anki_results)
                for preview in previews:
                    q.put(_sse("card_preview", preview))

            except (httpx.HTTPError, json.JSONDecodeError, ValueError, OSError) as e:
                words = ", ".join(p.get("word", "?") for p in chunk)
                log.error("Error generating chunk [%s]: %s", words, e)
                q.put(_sse("error", "Failed to generate cards for: {}".format(words)))

        def worker():
            try:
                ai_service.reload_prompts()
                settings = get_settings()
                target_deck = deck or settings.get("defaultDeck", "Bangla")
                language = ai_service.get_language_for_deck(target_deck)
                transliteration = settings.get("showTransliteration", False)

                chunks = [
                    pairs[i: i + CHUNK_SIZE]
                    for i in range(0, len(pairs), CHUNK_SIZE)
                ]
                with ThreadPoolExecutor(max_workers=3) as pool:
                    futures = [
                        pool.submit(
                            _process_chunk, chunk, target_deck,
                            language, transliteration,
                        )
                        for chunk in chunks
                    ]
                    for f in futures:
                        f.result()

                q.put(_sse("done", None))
            except (RuntimeError, ValueError, OSError) as e:
                log.error("Photo generate worker error: %s", e, exc_info=True)
                q.put(_sse("error", str(e)))
            finally:
                q.put(None)

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

        def stream():
            while True:
                item = q.get()
                if item is None:
                    break
                yield item

        return stream()
