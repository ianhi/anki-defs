"""PDF routes — scout (classify sections) and extract (cards per section).

The client parses the PDF with pdfjs and POSTs a list of structural sections
here. /api/pdf/scout runs one AI call that classifies each section and links
related ones via relatedTo. /api/pdf/extract takes a primary section plus any
supporting sections its relatedTo resolved to, and streams card previews.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from bottle import request, response

from .. import ai, card_extraction, session
from ..settings import get_settings
from ._helpers import (
    check_words_parallel,
    compute_cost,
    format_http_error,
    parse_cards_with_healing,
    parse_json_with_healing,
    sse_event,
    sse_stream,
)
from ._protocol import AnkiBackend

log = logging.getLogger(__name__)

_SHARED_PROMPTS_DIR = Path(__file__).resolve().parents[4] / "shared" / "prompts"


def _normalize_tags(tags: list[str]) -> list[str]:
    """Deduplicate, strip whitespace, keep order."""
    seen: set[str] = set()
    out: list[str] = []
    for t in tags:
        t2 = t.strip()
        if t2 and t2 not in seen:
            seen.add(t2)
            out.append(t2)
    return out


def _prompt_exists(filename: str) -> bool:
    return (_SHARED_PROMPTS_DIR / filename).is_file()


def register(app: Any, anki: AnkiBackend) -> None:
    @app.post("/api/pdf/scout")
    def scout() -> dict:
        body = request.json or {}
        sections: list[dict[str, Any]] = body.get("sections", [])
        deck: str | None = body.get("deck")
        if not sections:
            response.status = 400
            return {"error": "sections is required"}

        if os.environ.get("ANKI_DEFS_DEV"):
            ai.reload_prompts()

        try:
            settings = get_settings()
            target_deck = deck or settings.get("defaultDeck", "")
            language = ai.get_language_for_deck(target_deck)

            system_prompt, user_message = ai.build_pdf_scout_prompt(sections, language)
            result = ai.get_json_completion(system_prompt, user_message)
            raw = result.get("text", "")
            usage = result.get("usage")
            if usage:
                cost = compute_cost(usage)
                session.record_usage(usage, cost)

            def _record_heal(u: dict[str, Any]) -> None:
                nonlocal usage
                session.record_usage(u, compute_cost(u))
                usage = u  # overwrite so client sees combined

            parsed = parse_json_with_healing(raw, _record_heal)
            scouted_raw = parsed.get("sections") if isinstance(parsed, dict) else parsed
            if not isinstance(scouted_raw, list):
                raise ValueError("Scout response missing sections array")

            # Merge scout classifications back onto original sections by id.
            by_id = {s["id"]: s for s in sections}
            merged: list[dict[str, Any]] = []
            for entry in scouted_raw:
                if not isinstance(entry, dict) or not entry.get("id"):
                    continue
                original = by_id.get(entry["id"])
                if not original:
                    continue
                merged.append({
                    **original,
                    "contentType": entry.get("contentType", "prose"),
                    "suggestedTags": entry.get("suggestedTags", []),
                    "worthExtracting": bool(entry.get("worthExtracting", False)),
                    "confidence": float(entry.get("confidence", 0.0)),
                    "relatedTo": entry.get("relatedTo", []),
                })

            return {"sections": merged, "usage": usage}
        except httpx.HTTPStatusError as e:
            log.error("PDF scout HTTP error: %s", e)
            response.status = e.response.status_code
            return {"error": format_http_error(e)}
        except (httpx.HTTPError, json.JSONDecodeError, ValueError) as e:
            log.error("PDF scout error: %s", e, exc_info=True)
            response.status = 500
            return {"error": f"Scout failed: {e}"}

    @app.post("/api/pdf/extract")
    def extract() -> Iterator[str]:
        body = request.json or {}
        primary = body.get("primary") or {}
        supporting = body.get("supporting") or []
        tags = _normalize_tags(body.get("tags") or [])
        deck: str | None = body.get("deck")

        content_type = primary.get("contentType", "")
        primary_text = primary.get("text", "")
        if not content_type or not primary_text:
            response.status = 400
            return iter([
                sse_event({"type": "error", "data": "primary.contentType and text required"})
            ])

        if content_type == "exercise" and not _prompt_exists("pdf-cloze-extract.json"):
            response.status = 400
            return iter([
                sse_event({
                    "type": "error",
                    "data": (
                        "Cloze extraction prompt (pdf-cloze-extract.json) is not yet "
                        "available. Exercise sections cannot be extracted yet."
                    ),
                })
            ])

        def worker(q: Any) -> None:
            try:
                if os.environ.get("ANKI_DEFS_DEV"):
                    ai.reload_prompts()
                settings = get_settings()
                target_deck = deck or settings.get("defaultDeck", "")
                language = ai.get_language_for_deck(target_deck)
                transliteration = settings.get("showTransliteration", False)

                ctx = _ExtractCtx(
                    q=q,
                    target_deck=target_deck,
                    language=language,
                    transliteration=transliteration,
                    tags=tags,
                    anki=anki,
                )
                if content_type in ("vocab", "glossary"):
                    _run_vocab(ctx, primary_text)
                elif content_type == "passage":
                    glossary_text = _join_supporting_text(supporting, ("glossary", "vocab"))
                    _run_passage(ctx, primary_text, glossary_text)
                else:
                    q.put(sse_event({
                        "type": "error",
                        "data": f"Extraction for contentType '{content_type}' is not supported",
                    }))
                    return

                q.put(sse_event({"type": "done", "data": None}))
            except (httpx.HTTPError, json.JSONDecodeError, ValueError, OSError) as e:
                log.error("PDF extract worker error: %s", e, exc_info=True)
                q.put(sse_event({"type": "error", "data": str(e)}))

        return sse_stream(response, worker)


@dataclass
class _ExtractCtx:
    q: Any
    target_deck: str
    language: dict[str, Any]
    transliteration: bool
    tags: list[str]
    anki: AnkiBackend


def _join_supporting_text(supporting: list[dict[str, Any]], prefer: tuple[str, ...]) -> str:
    """Join supporting section text, preferring the given content types first."""
    picks = [s for s in supporting if s.get("contentType") in prefer]
    fallback = [s for s in supporting if s.get("contentType") not in prefer]
    return "\n\n".join(s.get("text", "") for s in picks + fallback if s.get("text"))


def _emit_usage(ctx: _ExtractCtx, usage: dict[str, Any] | None) -> None:
    if not usage:
        return
    session.record_usage(usage, compute_cost(usage))
    ctx.q.put(sse_event({"type": "usage", "data": usage}))


def _ai_json(ctx: _ExtractCtx, system_prompt: str, user_message: str) -> str:
    """Run a JSON completion, stream usage, return raw text."""
    result = ai.get_json_completion(system_prompt, user_message)
    _emit_usage(ctx, result.get("usage"))
    return result.get("text", "")


def _stream_previews(ctx: _ExtractCtx, cards: list[dict[str, Any]]) -> None:
    """Check cards against Anki, build previews, attach tags, emit via SSE."""
    words = [c.get("word", "") for c in cards if c.get("word")]
    anki_results = check_words_parallel(ctx.anki, words, ctx.target_deck)
    for preview in card_extraction.build_card_previews(cards, ctx.target_deck, anki_results):
        if ctx.tags:
            preview["tags"] = ctx.tags
        ctx.q.put(sse_event({"type": "card_preview", "data": preview}))


_VOCAB_BATCH_SIZE = 12


def _run_vocab(ctx: _ExtractCtx, section_text: str) -> None:
    """Extract pairs, then generate full cards in batches.

    The photo-generate prompt works best with ≤12 words at a time.
    Larger inputs cause the model to silently truncate output.
    """
    sys1, usr1 = ai.build_pdf_vocab_extract_prompt(section_text, ctx.language)
    parsed = ai.parse_json_response(_ai_json(ctx, sys1, usr1))
    pairs = parsed if isinstance(parsed, list) else parsed.get("pairs", [])
    pairs = [p for p in pairs if isinstance(p, dict) and p.get("word")]
    if not pairs:
        return

    for i in range(0, len(pairs), _VOCAB_BATCH_SIZE):
        batch = pairs[i : i + _VOCAB_BATCH_SIZE]
        sys2, usr2 = ai.build_photo_generate_prompt(batch, ctx.language, ctx.transliteration)
        cards = parse_cards_with_healing(
            _ai_json(ctx, sys2, usr2), lambda u: _emit_usage(ctx, u)
        )
        card_extraction.inject_textbook_definitions(cards, batch)
        _stream_previews(ctx, cards)


_PASSAGE_GLOSSARY_BATCH = 12


def _run_passage(ctx: _ExtractCtx, passage_text: str, glossary_text: str) -> None:
    """Passage + glossary → cards.  Batches glossary entries if large.

    The passage text is the same for every batch; only the glossary
    slice changes.  Without a glossary the prompt picks its own words
    from the passage (single call).
    """
    glossary_lines = (
        [ln for ln in glossary_text.splitlines() if ln.strip()] if glossary_text else []
    )

    if len(glossary_lines) <= _PASSAGE_GLOSSARY_BATCH:
        # Small enough for one call
        sys1, usr1 = ai.build_pdf_passage_extract_prompt(
            passage_text, glossary_text, ctx.language, ctx.transliteration
        )
        cards = parse_cards_with_healing(
            _ai_json(ctx, sys1, usr1), lambda u: _emit_usage(ctx, u)
        )
        _stream_previews(ctx, cards)
    else:
        for i in range(0, len(glossary_lines), _PASSAGE_GLOSSARY_BATCH):
            batch_text = "\n".join(glossary_lines[i : i + _PASSAGE_GLOSSARY_BATCH])
            sys1, usr1 = ai.build_pdf_passage_extract_prompt(
                passage_text, batch_text, ctx.language, ctx.transliteration
            )
            cards = parse_cards_with_healing(
                _ai_json(ctx, sys1, usr1), lambda u: _emit_usage(ctx, u)
            )
            _stream_previews(ctx, cards)
