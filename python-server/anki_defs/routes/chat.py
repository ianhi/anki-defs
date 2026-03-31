"""Chat routes — SSE streaming for AI card generation + relemmatize."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..config import SHARED_DIR
from ..services import ai, anki_connect, card_extraction, session
from ..services.settings import get_settings

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat")

# Pricing loaded from shared/data/model-pricing.json (single source of truth)
with open(SHARED_DIR / "data" / "model-pricing.json", encoding="utf-8") as _f:
    MODEL_PRICING: dict[str, dict[str, float]] = json.load(_f)


def _compute_cost(usage: dict[str, Any]) -> float:
    model = usage.get("model", "")
    pricing = MODEL_PRICING.get(model)
    if not pricing:
        return 0.0
    return (
        usage.get("inputTokens", 0) * pricing["input"]
        + usage.get("outputTokens", 0) * pricing["output"]
    ) / 1_000_000


def _sse_event(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"


@router.post("/stream", response_model=None)
async def stream(request: Request) -> StreamingResponse | JSONResponse:
    body = await request.json()
    new_message: str = body.get("newMessage", "")
    deck: str | None = body.get("deck")
    highlighted_words: list[str] | None = body.get("highlightedWords")
    user_context: str | None = body.get("userContext")
    mode: str | None = body.get("mode")

    if not new_message:
        return JSONResponse({"error": "newMessage is required"}, status_code=400)

    async def generate():  # type: ignore[return]
        if os.environ.get("ANKI_DEFS_DEV"):
            ai.reload_prompts()
        settings = get_settings()
        target_deck = deck or settings.get("defaultDeck", "Bangla")
        language = ai.get_language_for_deck(target_deck)
        prompts = ai.get_system_prompts(settings.get("showTransliteration", False), language)

        selection = ai.select_prompt(
            prompts,
            new_message,
            highlighted_words=highlighted_words,
            user_context=user_context,
            mode=mode,
        )

        if selection.mode == "sentence-blocked":
            yield _sse_event({
                "type": "error",
                "data": "Highlight the words you want cards for. "
                "On mobile: tap the crosshair icon then tap words. "
                "On desktop: select text and press Ctrl+B.",
            })
            yield _sse_event({"type": "done", "data": None})
            return

        system_prompt = selection.system_prompt
        user_message = selection.user_message
        is_english_to_bangla = selection.mode.startswith("english-to-bangla")
        has_highlighted = bool(highlighted_words and len(highlighted_words) > 0)
        log.info("Mode: %s", selection.mode)

        # Pre-check Anki for input words
        words_to_check: list[str] = []
        if not is_english_to_bangla:
            words_to_check = (highlighted_words or []) if has_highlighted else [new_message]

        anki_results: dict[str, Any | None] = {}

        async def _check_word(word: str) -> None:
            try:
                note = await asyncio.to_thread(
                    anki_connect.search_word_cached, word, target_deck
                )
                anki_results[word] = note
            except (RuntimeError, ValueError, httpx.HTTPError) as e:
                log.error("Anki search failed: %s", e)
                anki_results[word] = None

        if words_to_check:
            await asyncio.gather(*[_check_word(w) for w in words_to_check])

        try:
            # Single non-streaming AI call
            result = await asyncio.to_thread(
                ai.get_json_completion, system_prompt, user_message
            )
            raw_response = result.get("text", "")
            usage = result.get("usage")

            # Send usage event and record server-side
            if usage:
                yield _sse_event({"type": "usage", "data": usage})
                cost = _compute_cost(usage)
                await asyncio.to_thread(session.record_usage, usage, cost)

            # Parse and validate JSON response
            cards = None
            try:
                parsed = ai.parse_json_response(raw_response)
                cards = card_extraction.validate_card_responses(parsed)
            except (json.JSONDecodeError, ValueError):
                # Retry with healing prompt
                log.warning("JSON parse failed, retrying with healing prompt")
                try:
                    retry_result = await asyncio.to_thread(
                        ai.get_json_completion,
                        "Fix the following malformed JSON. Return ONLY valid JSON, nothing else.",
                        raw_response,
                    )
                    retry_usage = retry_result.get("usage")
                    if retry_usage:
                        yield _sse_event({"type": "usage", "data": retry_usage})
                        cost = _compute_cost(retry_usage)
                        await asyncio.to_thread(session.record_usage, retry_usage, cost)
                    parsed = ai.parse_json_response(retry_result.get("text", ""))
                    cards = card_extraction.validate_card_responses(parsed)
                except (json.JSONDecodeError, ValueError):
                    yield _sse_event({
                        "type": "error",
                        "data": "Failed to parse AI response as JSON",
                    })
                    yield _sse_event({"type": "done", "data": None})
                    return

            # Check Anki for any new words from AI response
            new_words = [
                c.get("word", "") for c in cards
                if c.get("word") and c["word"] not in anki_results
            ]
            if new_words:
                await asyncio.gather(*[_check_word(w) for w in new_words])

            # Build card previews
            field_mapping = settings.get("fieldMapping") or {}
            previews = card_extraction.build_card_previews(
                cards, target_deck, anki_results, field_mapping
            )

            for preview in previews:
                yield _sse_event({"type": "card_preview", "data": preview})

            yield _sse_event({"type": "done", "data": None})

        except (RuntimeError, ValueError, OSError) as e:
            log.error("Unexpected error: %s", e, exc_info=True)
            yield _sse_event({
                "type": "error",
                "data": str(e),
            })
            yield _sse_event({"type": "done", "data": None})

    return StreamingResponse(generate(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    })


@router.post("/distractors")
async def generate_distractors(request: Request) -> JSONResponse:
    """Generate 3 plausible-but-wrong distractors for a cloze card."""
    body = await request.json()
    word: str = body.get("word", "")
    sentence: str = body.get("sentence", "")
    definition: str = body.get("definition", "")

    if not word or not sentence or not definition:
        return JSONResponse(
            {"error": "word, sentence, and definition are required"}, status_code=400
        )

    try:
        system_prompt, user_message = ai.get_distractor_prompt(word, sentence, definition)
        result = await asyncio.to_thread(
            ai.get_json_completion, system_prompt, user_message
        )
        raw_response = result.get("text", "")

        try:
            parsed = ai.parse_json_response(raw_response)
        except (json.JSONDecodeError, ValueError):
            return JSONResponse(
                {"error": "Failed to parse AI response as JSON"}, status_code=500
            )

        distractors = parsed.get("distractors", [])
        return JSONResponse({"distractors": distractors})
    except (RuntimeError, ValueError, OSError) as e:
        log.error("Error generating distractors: %s", e)
        return JSONResponse(
            {"error": f"Failed to generate distractors: {e}"}, status_code=500
        )


@router.post("/relemmatize")
async def relemmatize(request: Request) -> JSONResponse:
    body = await request.json()
    word: str = body.get("word", "")
    sentence: str | None = body.get("sentence")
    deck: str | None = body.get("deck")

    if not word:
        return JSONResponse({"error": "word is required"}, status_code=400)

    try:
        language = ai.get_language_for_deck(deck) if deck else None
        prompt = ai.get_relemmatize_prompt(word, sentence, language)
        response = await asyncio.to_thread(ai.get_completion, prompt, word)

        try:
            parsed = json.loads(response)
        except (json.JSONDecodeError, ValueError):
            return JSONResponse({"lemma": word, "definition": ""})

        return JSONResponse({
            "lemma": parsed.get("lemma", word),
            "definition": parsed.get("definition", ""),
        })
    except (RuntimeError, ValueError, OSError) as e:
        log.error("Error relemmatizing word: %s", e)
        return JSONResponse({"error": "Failed to relemmatize word"}, status_code=500)
