"""Chat API handlers -- AI streaming and non-streaming endpoints."""

import concurrent.futures
import json
import threading

from ..server.sse import send_sse
from ..server.web import Response
from ..services import ai_service, anki_service
from ..services.card_extraction import (
    extract_cards,
    extract_inflected_forms,
    extract_sentence_translation,
    extract_vocabulary_list,
)
from ..services.settings_service import get_settings


def handle_stream(_params, _headers, body):
    """POST /api/chat/stream -- SSE endpoint for streaming AI responses."""
    data = json.loads(body) if body else {}
    new_message = data.get("newMessage", "")
    deck = data.get("deck")
    highlighted_words = data.get("highlightedWords", [])

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

    # Select prompt
    if has_highlighted:
        system_prompt = prompts["focusedWords"]
        user_message = "Sentence: {}\n\nFocus words: {}".format(
            new_message, ", ".join(highlighted_words)
        )
    elif is_single_word:
        system_prompt = prompts["word"]
        user_message = new_message
    else:
        system_prompt = prompts["sentence"]
        user_message = new_message

    # Pre-check Anki for highlighted words or single word (on main thread)
    words_to_check = (
        highlighted_words if has_highlighted else ([new_message] if is_single_word else [])
    )
    anki_results = {}
    for word in words_to_check:
        try:
            existing = anki_service.search_word(word, target_deck, field_mapping)
            anki_results[word] = existing is not None
        except Exception:
            pass

    # Return SSE response -- the callback runs in a daemon thread
    def sse_handler(sock):
        thread = threading.Thread(
            target=_stream_worker,
            args=(
                sock,
                system_prompt,
                user_message,
                new_message,
                target_deck,
                is_single_word,
                has_highlighted,
                highlighted_words,
                anki_results,
                field_mapping,
            ),
            daemon=True,
        )
        thread.start()

    return Response.sse(sse_handler)


def _stream_worker(
    sock,
    system_prompt,
    user_message,
    original_message,
    target_deck,
    is_single_word,
    has_highlighted,
    highlighted_words,
    anki_results,
    field_mapping,
):
    """Runs in a daemon thread -- handles AI streaming + card extraction."""
    full_response_parts = []

    def on_text(text):
        full_response_parts.append(text)
        send_sse(sock, "text", text)

    def on_usage(usage):
        send_sse(sock, "usage", usage)

    def on_done():
        try:
            full_response = "".join(full_response_parts)

            # Determine words for cards
            if has_highlighted:
                words_for_cards = highlighted_words
            elif is_single_word:
                words_for_cards = [original_message.strip()]
            else:
                words_for_cards = extract_vocabulary_list(full_response)

            is_sentence_mode = not is_single_word
            sentence_translation = (
                extract_sentence_translation(full_response) if is_sentence_mode else ""
            )
            inflected_forms = (
                extract_inflected_forms(full_response)
                if is_sentence_mode and not has_highlighted
                else None
            )

            # Card extraction needs Anki access (collection) -- use main thread bridge
            from aqt import mw

            future: concurrent.futures.Future = concurrent.futures.Future()

            def _extract_on_main():
                try:
                    previews, errors = extract_cards(
                        words_for_cards=words_for_cards,
                        full_response=full_response,
                        original_sentence=original_message,
                        sentence_translation=sentence_translation,
                        is_sentence_mode=is_sentence_mode,
                        target_deck=target_deck,
                        anki_results=anki_results,
                        inflected_forms=inflected_forms,
                    )
                    future.set_result((previews, errors))
                except Exception as e:
                    future.set_exception(e)

            mw.taskman.run_on_main(_extract_on_main)
            previews, errors = future.result(timeout=30)

            for preview in previews:
                send_sse(sock, "card_preview", preview)
            for error in errors:
                send_sse(sock, "error", error)
        except Exception as e:
            send_sse(sock, "error", str(e))

        send_sse(sock, "done", None)
        try:
            sock.close()
        except Exception:
            pass

    def on_error(error_msg):
        send_sse(sock, "error", error_msg)
        send_sse(sock, "done", None)
        try:
            sock.close()
        except Exception:
            pass

    ai_service.stream_completion(system_prompt, user_message, on_text, on_usage, on_done, on_error)


def handle_define(_params, _headers, body):
    """POST /api/chat/define -- Get definition for a word (non-streaming)."""
    data = json.loads(body) if body else {}
    word = data.get("word", "")
    deck = data.get("deck")

    if not word:
        return Response.error("word is required", 400)

    try:
        settings = get_settings()
        target_deck = deck or settings.get("defaultDeck", "Bangla")
        field_mapping = settings.get("fieldMapping")

        exists_in_anki = False
        note_id = None
        try:
            existing = anki_service.search_word(word, target_deck, field_mapping)
            if existing:
                exists_in_anki = True
                note_id = existing.get("noteId")
        except Exception:
            pass

        prompts = ai_service.get_system_prompts(settings.get("showTransliteration", False))
        response = ai_service.get_completion(prompts["define"], word)

        try:
            parsed = json.loads(response)
        except (json.JSONDecodeError, ValueError):
            result = {"word": word, "definition": response, "existsInAnki": exists_in_anki}
            if note_id is not None:
                result["noteId"] = note_id
            return Response.json(result)

        parsed["existsInAnki"] = exists_in_anki
        if note_id is not None:
            parsed["noteId"] = note_id
        return Response.json(parsed)
    except Exception as e:
        return Response.error("Failed to get definition: {}".format(e))


def handle_relemmatize(_params, _headers, body):
    """POST /api/chat/relemmatize -- Re-check the dictionary form of a word."""
    data = json.loads(body) if body else {}
    word = data.get("word", "")
    sentence = data.get("sentence")

    if not word:
        return Response.error("word is required", 400)

    try:
        context = "\nContext sentence: {}".format(sentence) if sentence else ""
        prompt = (
            'What is the correct Bangla dictionary/lemma form of "{word}"?{context}\n\n'
            "Return ONLY valid JSON:\n"
            "{{\n"
            '  "lemma": "the dictionary form (verbal noun for verbs, bare noun without case endings, etc.)",\n'
            '  "definition": "concise English definition (under 10 words)"\n'
            "}}\n\n"
            "Bangla Lemmatization Rules:\n"
            "- Nouns: Remove case endings.\n"
            "- Verbs: Convert to verbal noun.\n"
            "- Adjectives: Use base form."
        ).format(word=word, context=context)

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


def handle_analyze(_params, _headers, body):
    """POST /api/chat/analyze -- Analyze sentence."""
    data = json.loads(body) if body else {}
    sentence = data.get("sentence", "")
    deck = data.get("deck")

    if not sentence:
        return Response.error("sentence is required", 400)

    try:
        settings = get_settings()
        target_deck = deck or settings.get("defaultDeck", "Bangla")
        field_mapping = settings.get("fieldMapping")

        prompts = ai_service.get_system_prompts(settings.get("showTransliteration", False))
        response = ai_service.get_completion(prompts["analyze"], sentence)

        try:
            parsed = json.loads(response)
        except (json.JSONDecodeError, ValueError):
            return Response.json(
                {
                    "originalSentence": sentence,
                    "translation": response,
                    "words": [],
                }
            )

        words = parsed.get("words", [])
        lemmas = [w.get("lemma", "") for w in words if w.get("lemma")]

        anki_results = {}
        try:
            anki_results = anki_service.search_words(lemmas, target_deck, field_mapping)
        except Exception:
            pass

        enriched_words = []
        for w in words:
            lemma = w.get("lemma", "")
            enriched = dict(w)
            enriched["existsInAnki"] = lemma in anki_results
            note = anki_results.get(lemma)
            if note:
                enriched["noteId"] = note.get("noteId")
            enriched_words.append(enriched)

        result = {
            "originalSentence": sentence,
            "translation": parsed.get("translation"),
            "words": enriched_words,
        }
        if parsed.get("grammar"):
            result["grammar"] = parsed["grammar"]
        return Response.json(result)
    except Exception as e:
        return Response.error("Failed to analyze sentence: {}".format(e))
