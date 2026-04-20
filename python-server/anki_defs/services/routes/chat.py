"""Chat routes — SSE streaming for AI card generation + relemmatize."""

from __future__ import annotations

import json
import logging
import os
import queue
import threading
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx
from bottle import request, response

from .. import ai, card_extraction, session
from ..settings import get_settings
from ._helpers import compute_cost, format_http_error, sse_event

log = logging.getLogger(__name__)


def _check_words_parallel(
    anki: Any, words: list[str], target_deck: str,
) -> dict[str, Any | None]:
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


def register(app: Any, anki: Any) -> None:
    @app.post("/api/chat/stream")
    def stream() -> Iterator[str]:
        body = request.json or {}
        new_message: str = body.get("newMessage", "")
        deck: str | None = body.get("deck")
        highlighted_words: list[str] | None = body.get("highlightedWords")
        user_context: str | None = body.get("userContext")
        mode: str | None = body.get("mode")

        if not new_message:
            response.status = 400
            return iter([sse_event({"type": "error", "data": "newMessage is required"})])

        response.content_type = "text/event-stream"
        response.set_header("Cache-Control", "no-cache")

        q: queue.Queue[str | None] = queue.Queue()

        def worker() -> None:
            try:
                if os.environ.get("ANKI_DEFS_DEV"):
                    ai.reload_prompts()
                settings = get_settings()
                target_deck = deck or settings.get("defaultDeck", "Bangla")
                language = ai.get_language_for_deck(target_deck)
                prompts = ai.get_system_prompts(
                    settings.get("showTransliteration", False), language
                )

                selection = ai.select_prompt(
                    prompts,
                    new_message,
                    highlighted_words=highlighted_words,
                    user_context=user_context,
                    mode=mode,
                )

                if selection.mode == "sentence-translate":
                    _sentence_translate(q, selection.system_prompt, selection.user_message)
                    return

                _json_pipeline(q, anki, selection, target_deck, highlighted_words)
            except (RuntimeError, ValueError, OSError) as e:
                log.error("Stream worker error: %s", e, exc_info=True)
                q.put(sse_event({"type": "error", "data": str(e)}))
            finally:
                q.put(None)

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

        def generate() -> Iterator[str]:
            while True:
                item = q.get()
                if item is None:
                    break
                yield item

        return generate()

    @app.post("/api/chat/distractors")
    def generate_distractors() -> dict:
        body = request.json or {}
        word: str = body.get("word", "")
        sentence: str = body.get("sentence", "")
        definition: str = body.get("definition", "")

        if not word or not sentence or not definition:
            response.status = 400
            return {"error": "word, sentence, and definition are required"}

        try:
            system_prompt, user_message = ai.get_distractor_prompt(
                word, sentence, definition
            )
            result = ai.get_json_completion(system_prompt, user_message)
            raw_response = result.get("text", "")

            try:
                parsed = ai.parse_json_response(raw_response)
            except (json.JSONDecodeError, ValueError):
                response.status = 500
                return {"error": "Failed to parse AI response as JSON"}

            distractors = parsed.get("distractors", [])
            return {"distractors": distractors}
        except httpx.HTTPError as e:
            log.error("Error generating distractors: %s", e)
            response.status = 500
            return {"error": format_http_error(e)}
        except (RuntimeError, ValueError, OSError) as e:
            log.error("Error generating distractors: %s", e)
            response.status = 500
            return {"error": f"Failed to generate distractors: {e}"}

    @app.post("/api/chat/relemmatize")
    def relemmatize() -> dict:
        body = request.json or {}
        word: str = body.get("word", "")
        sentence: str | None = body.get("sentence")
        rq_deck: str | None = body.get("deck")

        if not word:
            response.status = 400
            return {"error": "word is required"}

        try:
            settings = get_settings()
            target_deck = rq_deck or settings.get("defaultDeck", "Bangla")
            language = ai.get_language_for_deck(target_deck)
            prompt = ai.get_relemmatize_prompt(word, sentence, language)
            resp = ai.get_completion(prompt, word)

            try:
                parsed = json.loads(resp)
            except (json.JSONDecodeError, ValueError):
                return {"lemma": word, "definition": ""}

            return {
                "lemma": parsed.get("lemma", word),
                "definition": parsed.get("definition", ""),
            }
        except httpx.HTTPError as e:
            log.error("Error relemmatizing word: %s", e)
            response.status = 500
            return {"error": format_http_error(e)}
        except (RuntimeError, ValueError, OSError) as e:
            log.error("Error relemmatizing word: %s", e)
            response.status = 500
            return {"error": "Failed to relemmatize word"}


def _sentence_translate(
    q: queue.Queue[str | None], system_prompt: str, user_message: str,
) -> None:
    try:
        result = ai.get_text_completion(system_prompt, user_message)
        usage = result.get("usage")
        if usage:
            cost = compute_cost(usage)
            session.record_usage(usage, cost)
            q.put(sse_event({"type": "usage", "data": usage}))
        q.put(sse_event({"type": "text", "data": result.get("text", "")}))
    except httpx.HTTPError as e:
        log.error("Sentence translate HTTP error: %s", e)
        q.put(sse_event({"type": "error", "data": format_http_error(e)}))
    except (RuntimeError, ValueError, OSError) as e:
        log.error("Sentence translate error: %s", e)
        q.put(sse_event({"type": "error", "data": str(e)}))
    q.put(sse_event({"type": "done", "data": None}))


def _json_pipeline(
    q: queue.Queue[str | None],
    anki: Any,
    selection: Any,
    target_deck: str,
    highlighted_words: list[str] | None,
) -> None:
    is_english_to_target = selection.mode.startswith("english-to-target")
    has_highlighted = bool(highlighted_words and len(highlighted_words) > 0)

    words_to_check: list[str] = []
    if not is_english_to_target:
        words_to_check = (
            (highlighted_words or []) if has_highlighted else [selection.user_message]
        )

    anki_results: dict[str, Any | None] = {}
    if words_to_check:
        anki_results = _check_words_parallel(anki, words_to_check, target_deck)

    try:
        result = ai.get_json_completion(
            selection.system_prompt, selection.user_message
        )
        raw_response = result.get("text", "")
        usage = result.get("usage")

        if usage:
            cost = compute_cost(usage)
            session.record_usage(usage, cost)
            q.put(sse_event({"type": "usage", "data": usage}))

        cards = None
        try:
            parsed = ai.parse_json_response(raw_response)
            cards = card_extraction.validate_card_responses(parsed)
        except (json.JSONDecodeError, ValueError):
            log.warning("JSON parse failed, retrying with healing prompt")
            try:
                retry_result = ai.get_json_completion(
                    "Fix the following malformed JSON. "
                    "Return ONLY valid JSON, nothing else.",
                    raw_response,
                )
                retry_usage = retry_result.get("usage")
                if retry_usage:
                    cost = compute_cost(retry_usage)
                    session.record_usage(retry_usage, cost)
                    q.put(sse_event({"type": "usage", "data": retry_usage}))
                parsed = ai.parse_json_response(
                    retry_result.get("text", "")
                )
                cards = card_extraction.validate_card_responses(parsed)
            except (json.JSONDecodeError, ValueError):
                q.put(sse_event({
                    "type": "error",
                    "data": "Failed to parse AI response as JSON",
                }))
                q.put(sse_event({"type": "done", "data": None}))
                return

        new_words = [
            c.get("word", "")
            for c in cards
            if c.get("word") and c["word"] not in anki_results
        ]
        if new_words:
            anki_results.update(
                _check_words_parallel(anki, new_words, target_deck)
            )

        previews = card_extraction.build_card_previews(
            cards, target_deck, anki_results
        )
        for preview in previews:
            q.put(sse_event({"type": "card_preview", "data": preview}))

        q.put(sse_event({"type": "done", "data": None}))

    except httpx.HTTPError as e:
        log.error("JSON pipeline HTTP error: %s", e)
        q.put(sse_event({"type": "error", "data": format_http_error(e)}))
        q.put(sse_event({"type": "done", "data": None}))
    except (RuntimeError, ValueError, OSError) as e:
        log.error("JSON pipeline error: %s", e, exc_info=True)
        q.put(sse_event({"type": "error", "data": str(e)}))
        q.put(sse_event({"type": "done", "data": None}))
