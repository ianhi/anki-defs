"""Chat API handlers -- JSON-first card generation pipeline."""

import concurrent.futures
import json
import threading

from ..server.sse import send_sse
from ..server.web import Response
from ..services import ai_service, anki_service
from ..services.card_extraction import build_card_previews
from ..services.settings_service import get_settings


def handle_stream(_params, _headers, body):
    """POST /api/chat/stream -- SSE endpoint for AI-generated card data.

    JSON-first pipeline: one non-streaming LLM call returns JSON directly,
    then card previews are built and sent as SSE events.
    """
    data = json.loads(body) if body else {}
    new_message = data.get("newMessage", "")
    deck = data.get("deck")
    highlighted_words = data.get("highlightedWords", [])
    user_context = data.get("userContext", "")

    if not new_message:
        return Response.error("newMessage is required", 400)

    # Gather context on main thread (collection access is safe here)
    settings = get_settings()
    target_deck = deck or settings.get("defaultDeck", "Bangla")
    field_mapping = settings.get("fieldMapping")
    prompts = ai_service.get_system_prompts(settings.get("showTransliteration", False))

    trimmed = new_message.strip()
    is_single_word = " " not in trimmed and len(trimmed) < 30
    has_highlighted = bool(highlighted_words)

    # Block sentence without highlights
    if not is_single_word and not has_highlighted:
        def sse_handler(sock):
            send_sse(
                sock,
                "error",
                "Sentence mode without highlighted words is not supported. "
                "Please highlight the words you want to learn.",
            )
            send_sse(sock, "done", None)
            try:
                sock.close()
            except Exception:
                pass

        return Response.sse(sse_handler)

    # Select prompt and build user message
    if has_highlighted:
        system_prompt = prompts["focusedWords"]
        rendered = ai_service.render_user_template(
            "focusedWords",
            {
                "sentence": new_message,
                "highlightedWords": ", ".join(highlighted_words),
            },
        )
        user_message = (
            rendered
            or "Sentence: {}\n\nFocus words: {}".format(
                new_message, ", ".join(highlighted_words)
            )
        )
    else:
        system_prompt = prompts["word"]
        rendered = ai_service.render_user_template(
            "word",
            {"word": new_message, "userContext": user_context},
        )
        user_message = rendered or new_message

    # Pre-check Anki for input words (on main thread -- collection access)
    words_to_check = highlighted_words if has_highlighted else [new_message]
    anki_results = {}
    for word in words_to_check:
        try:
            existing = anki_service.search_word(word, target_deck, field_mapping)
            anki_results[word] = existing  # note dict or None
        except Exception:
            anki_results[word] = None

    # Return SSE response -- the worker runs in a daemon thread
    def sse_handler(sock):
        thread = threading.Thread(
            target=_json_pipeline_worker,
            args=(
                sock,
                system_prompt,
                user_message,
                target_deck,
                anki_results,
            ),
            daemon=True,
        )
        thread.start()

    return Response.sse(sse_handler)


def _json_pipeline_worker(sock, system_prompt, user_message, target_deck, anki_results):
    """Runs in a daemon thread -- JSON-first card generation pipeline.

    1. Single non-streaming LLM call for JSON
    2. Parse JSON with fault tolerance
    3. Build card previews (Anki check on main thread)
    4. Emit SSE events: usage, card_preview (per card), done
    """
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
            cards = parsed if isinstance(parsed, list) else [parsed]
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
                cards = parsed if isinstance(parsed, list) else [parsed]
            except (json.JSONDecodeError, ValueError):
                send_sse(sock, "error", "Failed to parse AI response as JSON")
                send_sse(sock, "done", None)
                try:
                    sock.close()
                except Exception:
                    pass
                return

        # Build card previews -- needs Anki access (collection) on main thread
        from aqt import mw

        future = concurrent.futures.Future()

        def _build_on_main():
            try:
                previews = build_card_previews(cards, target_deck, anki_results)
                future.set_result(previews)
            except Exception as e:
                future.set_exception(e)

        mw.taskman.run_on_main(_build_on_main)
        previews = future.result(timeout=30)

        for preview in previews:
            send_sse(sock, "card_preview", preview)

    except Exception as e:
        send_sse(sock, "error", str(e))

    send_sse(sock, "done", None)
    try:
        sock.close()
    except Exception:
        pass


def handle_relemmatize(_params, _headers, body):
    """POST /api/chat/relemmatize -- Re-check the dictionary form of a word."""
    data = json.loads(body) if body else {}
    word = data.get("word", "")
    sentence = data.get("sentence")

    if not word:
        return Response.error("word is required", 400)

    try:
        import os

        prompts_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "shared",
            "prompts",
        )
        with open(os.path.join(prompts_dir, "relemmatize.json"), "r", encoding="utf-8") as f:
            relemmatize_prompt = json.load(f)

        context = "\nContext sentence: {}".format(sentence) if sentence else ""
        prompt = (
            relemmatize_prompt["system"].replace("{{word}}", word).replace("{{context}}", context)
        )

        response = ai_service.get_completion(prompt, word)

        try:
            parsed = json.loads(response)
        except (json.JSONDecodeError, ValueError):
            return Response.json({"lemma": word, "definition": ""})

        return Response.json(
            {
                "lemma": parsed.get("lemma", word),
                "definition": parsed.get("definition", ""),
            }
        )
    except Exception as e:
        return Response.error("Failed to relemmatize word: {}".format(e))
