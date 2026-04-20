"""Chat API routes — JSON-first card generation pipeline."""

import json
import logging
import queue
import threading

import httpx
from anki_defs._services import ai as ai_service
from anki_defs._services.card_extraction import build_card_previews, validate_card_responses
from anki_defs.server.sse import format_sse_event
from anki_defs.services import anki_service
from anki_defs.services.settings_service import get_settings
from bottle import request, response

log = logging.getLogger(__name__)


def _format_http_error(exc):
    """Turn an httpx error into a user-facing message with the upstream detail."""
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


def _sse(event_type, data):
    return format_sse_event(event_type, data)


def register(app):
    @app.post("/api/chat/stream")
    def handle_stream():
        data = request.json or {}
        new_message = data.get("newMessage", "")
        deck = data.get("deck")
        highlighted_words = data.get("highlightedWords")
        user_context = data.get("userContext", "")
        mode = data.get("mode")

        if not new_message:
            response.status = 400
            return iter([_sse("error", "newMessage is required")])

        response.content_type = "text/event-stream"
        response.set_header("Cache-Control", "no-cache")

        q = queue.Queue()

        def worker():
            try:
                settings = get_settings()
                target_deck = deck or settings.get("defaultDeck", "Bangla")
                language = ai_service.get_language_for_deck(target_deck)
                prompts = ai_service.get_system_prompts(
                    settings.get("showTransliteration", False), language
                )

                selection = ai_service.select_prompt(
                    prompts,
                    new_message,
                    highlighted_words=highlighted_words,
                    user_context=user_context,
                    mode=mode,
                )

                if selection.mode == "sentence-translate":
                    _sentence_translate_worker(q, selection.system_prompt, selection.user_message)
                    return

                _json_pipeline_worker(
                    q, selection.system_prompt, selection.user_message,
                    target_deck, highlighted_words,
                )
            except (RuntimeError, ValueError, OSError) as e:
                log.error("Stream worker error: %s", e, exc_info=True)
                q.put(_sse("error", str(e)))
            finally:
                q.put(None)

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

        def generate():
            while True:
                item = q.get()
                if item is None:
                    break
                yield item

        return generate()

    @app.post("/api/prompts/preview")
    def handle_prompt_preview():
        data = request.json or {}
        new_message = data.get("newMessage", "")
        highlighted_words = data.get("highlightedWords")
        mode = data.get("mode")

        if not new_message:
            response.status = 400
            return {"error": "newMessage is required"}

        settings = get_settings()
        deck = data.get("deck")
        target_deck = deck or settings.get("defaultDeck", "Bangla")
        language = ai_service.get_language_for_deck(target_deck)
        prompts = ai_service.get_system_prompts(
            settings.get("showTransliteration", False), language
        )

        selection = ai_service.select_prompt(
            prompts,
            new_message,
            highlighted_words=highlighted_words,
            mode=mode,
        )

        return {
            "mode": selection.mode,
            "systemPrompt": selection.system_prompt,
            "userMessage": selection.user_message,
        }

    @app.post("/api/chat/distractors")
    def handle_distractors():
        data = request.json or {}
        word = data.get("word", "")
        sentence = data.get("sentence", "")
        definition = data.get("definition", "")

        if not word or not sentence or not definition:
            response.status = 400
            return {"error": "word, sentence, and definition are required"}

        try:
            system_prompt, user_message = ai_service.get_distractor_prompt(
                word, sentence, definition
            )
            result = ai_service.get_json_completion(system_prompt, user_message)
            raw_response = result.get("text", "")

            try:
                parsed = ai_service.parse_json_response(raw_response)
            except (json.JSONDecodeError, ValueError):
                response.status = 500
                return {"error": "Failed to parse AI response as JSON"}

            distractors = parsed.get("distractors", [])
            return {"distractors": distractors}
        except httpx.HTTPError as e:
            log.error("Error generating distractors: %s", e)
            response.status = 500
            return {"error": _format_http_error(e)}
        except (RuntimeError, ValueError, OSError) as e:
            log.error("Error generating distractors: %s", e)
            response.status = 500
            return {"error": f"Failed to generate distractors: {e}"}

    @app.post("/api/chat/relemmatize")
    def handle_relemmatize():
        data = request.json or {}
        word = data.get("word", "")
        sentence = data.get("sentence")

        if not word:
            response.status = 400
            return {"error": "word is required"}

        try:
            prompt = ai_service.get_relemmatize_prompt(word, sentence)
            resp = ai_service.get_completion(prompt, word)

            try:
                parsed = json.loads(resp)
            except (json.JSONDecodeError, ValueError):
                return {"lemma": word, "definition": ""}

            return {
                "lemma": parsed.get("lemma", word),
                "definition": parsed.get("definition", ""),
            }
        except httpx.HTTPError as e:
            log.error("Error relemmatizing: %s", e)
            response.status = 500
            return {"error": _format_http_error(e)}
        except (RuntimeError, ValueError, OSError) as e:
            log.error("Error relemmatizing: %s", e)
            response.status = 500
            return {"error": f"Failed to relemmatize word: {e}"}


def _sentence_translate_worker(q, system_prompt, user_message):
    """Runs in a daemon thread — plain text translation for sentence mode."""
    try:
        result = ai_service.get_text_completion(system_prompt, user_message)
        usage = result.get("usage")

        if usage:
            q.put(_sse("usage", usage))

        q.put(_sse("text", result.get("text", "")))

    except httpx.HTTPError as e:
        log.error("Sentence translate HTTP error: %s", e)
        q.put(_sse("error", _format_http_error(e)))
    except (RuntimeError, ValueError, OSError) as e:
        log.error("Sentence translate error: %s", e)
        q.put(_sse("error", str(e)))

    q.put(_sse("done", None))


def _json_pipeline_worker(q, system_prompt, user_message, target_deck, highlighted_words):
    """Runs in a daemon thread — JSON-first card generation pipeline."""
    is_english_to_target = "english-to-target" in (system_prompt or "")
    has_highlighted = bool(highlighted_words and len(highlighted_words) > 0)

    words_to_check = []
    if not is_english_to_target:
        words_to_check = highlighted_words if has_highlighted else [user_message]

    anki_results = {}
    for word in words_to_check:
        try:
            existing = anki_service.search_word(word, target_deck)
            anki_results[word] = existing
        except (RuntimeError, ValueError):
            anki_results[word] = None

    try:
        result = ai_service.get_json_completion(system_prompt, user_message)
        raw_response = result.get("text", "")
        usage = result.get("usage")

        if usage:
            q.put(_sse("usage", usage))

        cards = None
        try:
            parsed = ai_service.parse_json_response(raw_response)
            cards = validate_card_responses(parsed)
        except (json.JSONDecodeError, ValueError):
            try:
                retry_result = ai_service.get_json_completion(
                    "Fix the following malformed JSON. Return ONLY valid JSON, nothing else.",
                    raw_response,
                )
                retry_usage = retry_result.get("usage")
                if retry_usage:
                    q.put(_sse("usage", retry_usage))
                parsed = ai_service.parse_json_response(retry_result.get("text", ""))
                cards = validate_card_responses(parsed)
            except (json.JSONDecodeError, ValueError):
                q.put(_sse("error", "Failed to parse AI response as JSON"))
                q.put(_sse("done", None))
                return

        for card in cards:
            word = card.get("word", "")
            if word and word not in anki_results:
                try:
                    existing = anki_service.search_word(word, target_deck)
                    anki_results[word] = existing
                except (RuntimeError, ValueError):
                    anki_results[word] = None

        previews = build_card_previews(cards, target_deck, anki_results)
        for preview in previews:
            q.put(_sse("card_preview", preview))

    except httpx.HTTPError as e:
        log.error("JSON pipeline HTTP error: %s", e)
        q.put(_sse("error", _format_http_error(e)))
    except (RuntimeError, ValueError, KeyError, OSError, json.JSONDecodeError) as e:
        log.error("JSON pipeline error: %s", e, exc_info=True)
        q.put(_sse("error", str(e)))

    q.put(_sse("done", None))
