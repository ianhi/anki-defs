"""Chat API handlers -- JSON-first card generation pipeline."""

import concurrent.futures
import json
import threading

from ..server.sse import send_sse
from ..server.web import Response
from ..services import ai_service, anki_service
from ..services.card_extraction import build_card_previews, validate_card_responses
from ..services.settings_service import get_settings


def handle_stream(_params, _headers, body):
    """POST /api/chat/stream -- SSE endpoint for AI-generated card data.

    JSON-first pipeline: one non-streaming LLM call returns JSON directly,
    then card previews are built and sent as SSE events.
    """
    data = json.loads(body) if body else {}
    new_message = data.get("newMessage", "")
    deck = data.get("deck")
    highlighted_words = data.get("highlightedWords")
    user_context = data.get("userContext", "")
    mode = data.get("mode")

    if not new_message:
        return Response.error("newMessage is required", 400)

    # Gather context on main thread (collection access is safe here)
    settings = get_settings()
    target_deck = deck or settings.get("defaultDeck", "Bangla")
    field_mapping = settings.get("fieldMapping") or {}
    prompts = ai_service.get_system_prompts(settings.get("showTransliteration", False))

    # Use shared selectPrompt logic (handles all modes including EN→BN)
    selection = ai_service.select_prompt(
        prompts,
        new_message,
        highlighted_words=highlighted_words,
        user_context=user_context,
        mode=mode,
    )

    if selection.mode == "sentence-blocked":
        def sse_handler(sock):
            send_sse(
                sock,
                "error",
                "Highlight the words you want cards for. "
                "On mobile: tap the crosshair icon then tap words. "
                "On desktop: select text and press Ctrl+B.",
            )
            send_sse(sock, "done", None)
            try:
                sock.close()
            except OSError:
                pass

        return Response.sse(sse_handler)

    system_prompt = selection.system_prompt
    user_message = selection.user_message
    is_english_to_bangla = selection.mode.startswith("english-to-bangla")
    has_highlighted = bool(highlighted_words and len(highlighted_words) > 0)

    # Pre-check Anki for input words (on main thread -- collection access)
    # For English→Bangla, skip pre-check since we don't know the Bangla word yet
    words_to_check = []
    if not is_english_to_bangla:
        words_to_check = highlighted_words if has_highlighted else [new_message]

    anki_results = {}
    for word in words_to_check:
        try:
            existing = anki_service.search_word(word, target_deck, field_mapping)
            anki_results[word] = existing
        except (RuntimeError, ValueError):
            anki_results[word] = None

    # Return SSE response -- the worker runs in a daemon thread
    def sse_handler(sock):
        thread = threading.Thread(
            target=_json_pipeline_worker,
            args=(sock, system_prompt, user_message, target_deck, anki_results, field_mapping),
            daemon=True,
        )
        thread.start()

    return Response.sse(sse_handler)


def _json_pipeline_worker(sock, system_prompt, user_message, target_deck, anki_results,
                          field_mapping):
    """Runs in a daemon thread -- JSON-first card generation pipeline."""
    try:
        # Single non-streaming AI call
        result = ai_service.get_json_completion(system_prompt, user_message)
        raw_response = result.get("text", "")
        usage = result.get("usage")

        # Send usage event
        if usage:
            send_sse(sock, "usage", usage)

        # Parse JSON response with fault tolerance
        cards = None
        try:
            parsed = ai_service.parse_json_response(raw_response)
            cards = validate_card_responses(parsed)
        except (json.JSONDecodeError, ValueError):
            # Retry with healing prompt
            try:
                retry_result = ai_service.get_json_completion(
                    "Fix the following malformed JSON. Return ONLY valid JSON, nothing else.",
                    raw_response,
                )
                retry_usage = retry_result.get("usage")
                if retry_usage:
                    send_sse(sock, "usage", retry_usage)
                parsed = ai_service.parse_json_response(retry_result.get("text", ""))
                cards = validate_card_responses(parsed)
            except (json.JSONDecodeError, ValueError):
                send_sse(sock, "error", "Failed to parse AI response as JSON")
                send_sse(sock, "done", None)
                try:
                    sock.close()
                except OSError:
                    pass
                return

        # Build card previews -- needs Anki access (collection) on main thread
        from aqt import mw

        future = concurrent.futures.Future()

        def _build_on_main():
            try:
                # Check Anki for any new words from AI response
                for card in cards:
                    word = card.get("word", "")
                    if word and word not in anki_results:
                        try:
                            existing = anki_service.search_word(
                                word, target_deck, field_mapping
                            )
                            anki_results[word] = existing
                        except (RuntimeError, ValueError):
                            anki_results[word] = None

                previews = build_card_previews(
                    cards, target_deck, anki_results, field_mapping
                )
                future.set_result(previews)
            except (RuntimeError, ValueError, KeyError) as e:
                future.set_exception(e)

        mw.taskman.run_on_main(_build_on_main)
        previews = future.result(timeout=30)

        for preview in previews:
            send_sse(sock, "card_preview", preview)

    except (RuntimeError, ValueError, KeyError, OSError, json.JSONDecodeError,
            concurrent.futures.TimeoutError) as e:
        send_sse(sock, "error", str(e))

    send_sse(sock, "done", None)
    try:
        sock.close()
    except OSError:
        pass


def handle_prompt_preview(_params, _headers, body):
    """POST /api/prompts/preview — render prompts without calling the LLM."""
    data = json.loads(body) if body else {}
    new_message = data.get("newMessage", "")
    highlighted_words = data.get("highlightedWords")
    mode = data.get("mode")

    if not new_message:
        return Response.error("newMessage is required", 400)

    settings = get_settings()
    prompts = ai_service.get_system_prompts(settings.get("showTransliteration", False))

    selection = ai_service.select_prompt(
        prompts,
        new_message,
        highlighted_words=highlighted_words,
        mode=mode,
    )

    return Response.json({
        "mode": selection.mode,
        "systemPrompt": selection.system_prompt,
        "userMessage": selection.user_message,
    })


def handle_distractors(_params, _headers, body):
    """POST /api/chat/distractors -- Generate distractors for a cloze card."""
    data = json.loads(body) if body else {}
    word = data.get("word", "")
    sentence = data.get("sentence", "")
    definition = data.get("definition", "")

    if not word or not sentence or not definition:
        return Response.error("word, sentence, and definition are required", 400)

    try:
        system_prompt, user_message = ai_service.get_distractor_prompt(
            word, sentence, definition
        )
        result = ai_service.get_json_completion(system_prompt, user_message)
        raw_response = result.get("text", "")

        try:
            parsed = json.loads(raw_response)
        except (json.JSONDecodeError, ValueError):
            # Try stripping markdown fences
            try:
                parsed = ai_service.parse_json_response(raw_response)
            except (json.JSONDecodeError, ValueError):
                return Response.error("Failed to parse AI response as JSON")

        distractors = parsed.get("distractors", [])
        return Response.json({"distractors": distractors})
    except (RuntimeError, ValueError, OSError) as e:
        return Response.error("Failed to generate distractors: {}".format(e))


def handle_relemmatize(_params, _headers, body):
    """POST /api/chat/relemmatize -- Re-check the dictionary form of a word."""
    data = json.loads(body) if body else {}
    word = data.get("word", "")
    sentence = data.get("sentence")

    if not word:
        return Response.error("word is required", 400)

    try:
        prompt = ai_service.get_relemmatize_prompt(word, sentence)
        response = ai_service.get_completion(prompt, word)

        try:
            parsed = json.loads(response)
        except (json.JSONDecodeError, ValueError):
            return Response.json({"lemma": word, "definition": ""})

        return Response.json({
            "lemma": parsed.get("lemma", word),
            "definition": parsed.get("definition", ""),
        })
    except (RuntimeError, ValueError, OSError) as e:
        return Response.error("Failed to relemmatize word: {}".format(e))
