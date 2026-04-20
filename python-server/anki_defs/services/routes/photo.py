"""Photo routes — extract vocab pairs from images and batch-generate cards."""

from __future__ import annotations

import base64
import json
import logging
import os
import queue
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import httpx
from bottle import request, response

from .. import ai, card_extraction, session
from ..settings import get_settings
from ._helpers import (
    MIME_TO_EXT,
    check_words_parallel,
    compute_cost,
    ext_to_mime,
    format_http_error,
    parse_cards_with_healing,
    sse_event,
    sse_stream,
    strip_article,
)
from ._protocol import AnkiBackend

log = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[4]
_DEV_IMAGES_DIR = _PROJECT_ROOT / "dev-images"
_EXTERNAL_PICS_DIR = _PROJECT_ROOT.parent / "example-pics"
_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def _save_dev_image(image_base64: str, mime_type: str) -> None:
    """Save uploaded image to dev-images/ for future dev testing."""
    import hashlib

    try:
        digest = hashlib.sha256(image_base64[:1024].encode()).hexdigest()[:12]
        ext = MIME_TO_EXT.get(mime_type, ".jpg")
        dest = _DEV_IMAGES_DIR / f"upload-{digest}{ext}"
        if dest.exists():
            return
        _DEV_IMAGES_DIR.mkdir(exist_ok=True)
        dest.write_bytes(base64.b64decode(image_base64))
        log.info("Saved dev image: %s", dest.name)
    except OSError as e:
        log.warning("Could not save dev image: %s", e)


def register(app: Any, anki: AnkiBackend) -> None:
    if os.environ.get("ANKI_DEFS_DEV"):

        def _image_dirs() -> list[Path]:
            return [
                d for d in (_DEV_IMAGES_DIR, _EXTERNAL_PICS_DIR) if d.exists()
            ]

        @app.get("/api/photo/examples")
        def list_examples() -> dict:
            files: list[Path] = []
            seen: set[str] = set()
            for d in _image_dirs():
                for f in d.iterdir():
                    if (
                        f.suffix.lower() in _IMAGE_SUFFIXES
                        and f.name not in seen
                    ):
                        files.append(f)
                        seen.add(f.name)
            files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
            return {"examples": [f.name for f in files]}

        @app.get("/api/photo/examples/<filename>")
        def get_example(filename: str) -> dict:
            for d in _image_dirs():
                path = d / filename
                if path.exists() and path.is_relative_to(d):
                    data = base64.b64encode(path.read_bytes()).decode()
                    mime = ext_to_mime(path.suffix)
                    return {
                        "imageBase64": data,
                        "mimeType": mime,
                        "filename": filename,
                    }
            response.status = 404
            return {"error": "Not found"}

    @app.post("/api/photo/extract")
    def extract() -> dict:
        upload = request.files.get("image")  # type: ignore[attr-defined]
        deck: str = request.forms.get("deck", "")  # type: ignore[attr-defined]
        instructions: str = request.forms.get("instructions", "")  # type: ignore[attr-defined]
        if not upload:
            response.status = 400
            return {"error": "image file is required"}

        image_base64 = base64.b64encode(upload.file.read()).decode()
        mime_type = upload.content_type or "image/jpeg"

        if os.environ.get("ANKI_DEFS_DEV"):
            ai.reload_prompts()
            _save_dev_image(image_base64, mime_type)

        try:
            result = ai.get_vision_extraction(
                image_base64, mime_type, instructions
            )
            usage = result.get("usage")
            if usage:
                cost = compute_cost(usage)
                session.record_usage(usage, cost)

            pairs = result["pairs"]
            if deck and pairs:
                target_deck = deck
                language = ai.get_language_for_deck(target_deck)
                for pair in pairs:
                    word = pair.get("word", "")
                    if not word:
                        continue
                    try:
                        existing = anki.search_word(word, target_deck)
                        if existing is None:
                            stripped = strip_article(word, language)
                            if stripped:
                                existing = anki.search_word(
                                    stripped, target_deck
                                )
                        if existing is not None:
                            pair["alreadyExists"] = True
                            fields = existing.get("fields", {})
                            for fname in (
                                "Definition",
                                "Definitions 1",
                                "Back",
                            ):
                                val = (
                                    fields.get(fname, {}).get("value", "")
                                )
                                if val:
                                    pair["existingDefinition"] = val
                                    break
                    except (RuntimeError, ValueError, httpx.HTTPError):
                        pass

            return {"pairs": pairs, "usage": usage}
        except httpx.HTTPStatusError as e:
            log.error("Photo extract HTTP error: %s", e)
            response.status = e.response.status_code
            return {"error": format_http_error(e)}
        except (httpx.HTTPError, ValueError, OSError) as e:
            log.error("Photo extract error: %s", e, exc_info=True)
            response.status = 500
            return {"error": f"Failed to extract vocab from image: {e}"}

    @app.post("/api/photo/generate")
    def generate() -> Iterator[str]:
        body = request.json or {}
        pairs: list[dict[str, str]] = body.get("pairs", [])
        deck: str | None = body.get("deck")

        if not pairs:
            response.status = 400
            return iter(
                [sse_event({"type": "error", "data": "pairs is required"})]
            )

        CHUNK_SIZE = 5

        def _process_chunk(
            q: queue.Queue[str | None],
            chunk: list[dict[str, str]],
            target_deck: str,
            language: dict[str, Any],
            transliteration: bool,
        ) -> None:
            try:
                system_prompt, user_message = (
                    ai.build_photo_generate_prompt(
                        chunk, language, transliteration
                    )
                )
                result = ai.get_json_completion(system_prompt, user_message)
                raw = result.get("text", "")
                usage = result.get("usage")

                if usage:
                    cost = compute_cost(usage)
                    session.record_usage(usage, cost)
                    q.put(sse_event({"type": "usage", "data": usage}))

                def _emit_usage(u: dict[str, Any]) -> None:
                    q.put(sse_event({"type": "usage", "data": u}))

                cards = parse_cards_with_healing(raw, _emit_usage)
                card_extraction.inject_textbook_definitions(cards, chunk)

                card_words = [
                    c.get("word", "") for c in cards if c.get("word")
                ]
                anki_results = check_words_parallel(
                    anki, card_words, target_deck
                )

                previews = card_extraction.build_card_previews(
                    cards, target_deck, anki_results
                )
                for preview in previews:
                    q.put(
                        sse_event({"type": "card_preview", "data": preview})
                    )

            except (
                httpx.HTTPError,
                json.JSONDecodeError,
                ValueError,
                OSError,
            ) as e:
                words = ", ".join(p.get("word", "?") for p in chunk)
                log.error("Error generating chunk [%s]: %s", words, e)
                q.put(sse_event({
                    "type": "error",
                    "data": f"Failed to generate cards for: {words}",
                }))

        def worker(q: queue.Queue[str | None]) -> None:
            try:
                if os.environ.get("ANKI_DEFS_DEV"):
                    ai.reload_prompts()
                settings = get_settings()
                target_deck = deck or settings.get("defaultDeck", "Bangla")
                language = ai.get_language_for_deck(target_deck)
                transliteration = settings.get(
                    "showTransliteration", False
                )

                chunks = [
                    pairs[i : i + CHUNK_SIZE]
                    for i in range(0, len(pairs), CHUNK_SIZE)
                ]

                from concurrent.futures import ThreadPoolExecutor

                with ThreadPoolExecutor(max_workers=3) as pool:
                    futures = [
                        pool.submit(
                            _process_chunk,
                            q,
                            chunk,
                            target_deck,
                            language,
                            transliteration,
                        )
                        for chunk in chunks
                    ]
                    for f in futures:
                        f.result()

                q.put(sse_event({"type": "done", "data": None}))
            except (RuntimeError, ValueError, OSError) as e:
                log.error(
                    "Photo generate worker error: %s", e, exc_info=True
                )
                q.put(sse_event({"type": "error", "data": str(e)}))

        return sse_stream(response, worker)
