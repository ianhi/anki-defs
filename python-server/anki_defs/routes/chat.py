"""Chat routes — SSE streaming for AI card generation + relemmatize."""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..services import ai, anki_connect, card_extraction, session
from ..services.settings import get_settings

router = APIRouter(prefix="/api/chat")

# Pricing table (must match shared/types.ts MODEL_PRICING)
MODEL_PRICING: dict[str, dict[str, float]] = {
    "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
    "gemini-2.5-flash-lite": {"input": 0.1, "output": 0.4},
    "gemini-2.0-flash": {"input": 0.1, "output": 0.4},
    "gemini-2.5-flash": {"input": 0.15, "output": 0.6},
    "gemini-2.5-pro": {"input": 1.25, "output": 10.0},
    "gemini-3-flash-preview": {"input": 0.5, "output": 3.0},
    "google/gemini-3-flash-preview": {"input": 0.5, "output": 3.0},
    "google/gemini-2.5-flash": {"input": 0.15, "output": 0.6},
    "openai/gpt-4.1-nano": {"input": 0.1, "output": 0.4},
    "openai/gpt-4.1-mini": {"input": 0.4, "output": 1.6},
    "meta-llama/llama-4-maverick:free": {"input": 0.0, "output": 0.0},
    "mistralai/mistral-small-3.1-24b-instruct:free": {"input": 0.0, "output": 0.0},
    "deepseek/deepseek-v3.2": {"input": 0.24, "output": 0.38},
}


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
        prompts = ai.get_system_prompts(settings.get("showTransliteration", False))

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
                "data": "Sentence mode without highlighted words is not supported. "
                "Please highlight the words you want to learn.",
            })
            yield _sse_event({"type": "done", "data": None})
            return

        system_prompt = selection.system_prompt
        user_message = selection.user_message
        is_english_to_bangla = selection.mode.startswith("english-to-bangla")
        has_highlighted = bool(highlighted_words and len(highlighted_words) > 0)
        print(f"[Chat] Mode: {selection.mode}")

        # Pre-check Anki for input words
        words_to_check: list[str] = []
        if not is_english_to_bangla:
            words_to_check = (highlighted_words or []) if has_highlighted else [new_message]

        anki_results: dict[str, Any | None] = {}
        for word in words_to_check:
            try:
                note = await asyncio.to_thread(
                    anki_connect.search_word_cached, word, target_deck
                )
                anki_results[word] = note
            except Exception as e:
                print(f"[Chat] Anki search failed: {e}")
                anki_results[word] = None

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
            except Exception:
                # Retry with healing prompt
                print("[Chat] JSON parse failed, retrying with healing prompt")
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
                except Exception:
                    yield _sse_event({
                        "type": "error",
                        "data": "Failed to parse AI response as JSON",
                    })
                    yield _sse_event({"type": "done", "data": None})
                    return

            # Check Anki for any new words from AI response
            for card in cards:
                word = card.get("word", "")
                if word and word not in anki_results:
                    try:
                        note = await asyncio.to_thread(
                            anki_connect.search_word_cached, word, target_deck
                        )
                        anki_results[word] = note
                    except Exception:
                        anki_results[word] = None

            # Build card previews
            field_mapping = settings.get("fieldMapping") or {}
            previews = card_extraction.build_card_previews(
                cards, target_deck, anki_results, field_mapping
            )

            for preview in previews:
                yield _sse_event({"type": "card_preview", "data": preview})

            yield _sse_event({"type": "done", "data": None})

        except Exception as e:
            print(f"[Chat] Unexpected error: {e}")
            yield _sse_event({
                "type": "error",
                "data": str(e),
            })
            yield _sse_event({"type": "done", "data": None})

    return StreamingResponse(generate(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    })


@router.post("/relemmatize")
async def relemmatize(request: Request) -> JSONResponse:
    body = await request.json()
    word: str = body.get("word", "")
    sentence: str | None = body.get("sentence")

    if not word:
        return JSONResponse({"error": "word is required"}, status_code=400)

    try:
        prompt = ai.get_relemmatize_prompt(word, sentence)
        response = await asyncio.to_thread(ai.get_completion, prompt, word)

        try:
            parsed = json.loads(response)
        except (json.JSONDecodeError, ValueError):
            return JSONResponse({"lemma": word, "definition": ""})

        return JSONResponse({
            "lemma": parsed.get("lemma", word),
            "definition": parsed.get("definition", ""),
        })
    except Exception as e:
        print(f"[Chat] Error relemmatizing word: {e}")
        return JSONResponse({"error": "Failed to relemmatize word"}, status_code=500)
