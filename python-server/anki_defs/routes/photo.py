"""Photo routes — extract vocab pairs from images and batch-generate cards."""

from __future__ import annotations

import base64
import json
import logging
import os
import queue
import threading
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import httpx
from bottle import Bottle, request, response

from ..services import ai, anki_connect, card_extraction, session
from ..services.settings import get_settings
from ._helpers import compute_cost, format_http_error, sse_event

log = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_DEV_IMAGES_DIR = _PROJECT_ROOT / "dev-images"
# Also check the external example-pics dir (may be owned by another user)
_EXTERNAL_PICS_DIR = _PROJECT_ROOT.parent / "example-pics"
_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}

_MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _save_dev_image(image_base64: str, mime_type: str) -> None:
    """Save uploaded image to example-pics/ for future dev testing."""
    import hashlib

    try:
        digest = hashlib.sha256(image_base64[:1024].encode()).hexdigest()[:12]
        ext = _MIME_TO_EXT.get(mime_type, ".jpg")
        dest = _DEV_IMAGES_DIR / f"upload-{digest}{ext}"
        if dest.exists():
            return
        _DEV_IMAGES_DIR.mkdir(exist_ok=True)
        dest.write_bytes(base64.b64decode(image_base64))
        log.info("Saved dev image: %s", dest.name)
    except OSError as e:
        log.warning("Could not save dev image: %s", e)


def _strip_article(word: str, language: dict[str, Any]) -> str | None:
    """Strip a leading article/particle from a word, return stripped form or None."""
    particles_str = language.get("sentenceAnalysis", {}).get("skipParticles", "")
    if not particles_str:
        return None
    # Only check common articles (first few particles), not all 60+ entries
    particles = [p.strip().lower() for p in particles_str.split(",")][:20]
    lower = word.lower()
    for p in particles:
        prefix = p + " "
        if lower.startswith(prefix) and len(word) > len(prefix):
            return word[len(prefix):]
    return None


def register(app: Bottle) -> None:
    if os.environ.get("ANKI_DEFS_DEV"):

        def _image_dirs() -> list[Path]:
            return [d for d in (_DEV_IMAGES_DIR, _EXTERNAL_PICS_DIR) if d.exists()]

        @app.get("/api/photo/examples")
        def list_examples() -> dict:
            files: list[Path] = []
            seen: set[str] = set()
            for d in _image_dirs():
                for f in d.iterdir():
                    if f.suffix.lower() in _IMAGE_SUFFIXES and f.name not in seen:
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
                    mime_map = {
                        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                        ".png": "image/png", ".webp": "image/webp",
                    }
                    mime = mime_map.get(path.suffix.lower(), "image/jpeg")
                    return {"imageBase64": data, "mimeType": mime, "filename": filename}
            response.status = 404
            return {"error": "Not found"}

    @app.post("/api/photo/extract")
    def extract() -> dict:
        upload = request.files.get("image")  # type: ignore[attr-defined]
        deck: str = request.forms.get("deck", "")  # type: ignore[attr-defined]
        if not upload:
            response.status = 400
            return {"error": "image file is required"}

        image_base64 = base64.b64encode(upload.file.read()).decode()
        mime_type = upload.content_type or "image/jpeg"

        if os.environ.get("ANKI_DEFS_DEV"):
            ai.reload_prompts()
            _save_dev_image(image_base64, mime_type)

        try:
            result = ai.get_vision_extraction(image_base64, mime_type)
            usage = result.get("usage")
            if usage:
                cost = compute_cost(usage)
                session.record_usage(usage, cost)

            pairs = result["pairs"]
            if deck and pairs:
                settings = get_settings()
                target_deck = deck or settings.get("defaultDeck", "Bangla")
                language = ai.get_language_for_deck(target_deck)
                for pair in pairs:
                    word = pair.get("word", "")
                    if not word:
                        continue
                    try:
                        existing = anki_connect.search_word_cached(word, target_deck)
                        if existing is None:
                            stripped = _strip_article(word, language)
                            if stripped:
                                existing = anki_connect.search_word_cached(
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
            return iter([sse_event({"type": "error", "data": "pairs is required"})])

        response.content_type = "text/event-stream"
        response.set_header("Cache-Control", "no-cache")

        q: queue.Queue[str | None] = queue.Queue()

        CHUNK_SIZE = 5

        def _process_chunk(
            chunk: list[dict[str, str]],
            target_deck: str,
            language: dict[str, Any],
            transliteration: bool,
        ) -> None:
            """Generate cards for a chunk of word pairs (single AI call)."""
            try:
                system_prompt, user_message = ai.build_photo_generate_prompt(
                    chunk, language, transliteration
                )
                result = ai.get_json_completion(system_prompt, user_message)
                raw = result.get("text", "")
                usage = result.get("usage")

                if usage:
                    cost = compute_cost(usage)
                    session.record_usage(usage, cost)
                    q.put(sse_event({"type": "usage", "data": usage}))

                try:
                    parsed = ai.parse_json_response(raw)
                    cards = card_extraction.validate_card_responses(parsed)
                except (json.JSONDecodeError, ValueError):
                    log.warning("JSON parse failed for chunk, retrying")
                    retry = ai.get_json_completion(
                        "Fix the following malformed JSON. Return ONLY valid JSON.",
                        raw,
                    )
                    retry_usage = retry.get("usage")
                    if retry_usage:
                        cost = compute_cost(retry_usage)
                        session.record_usage(retry_usage, cost)
                        q.put(sse_event({"type": "usage", "data": retry_usage}))
                    parsed = ai.parse_json_response(retry.get("text", ""))
                    cards = card_extraction.validate_card_responses(parsed)

                # Check Anki for duplicates
                anki_results: dict[str, Any | None] = {}
                for c in cards:
                    w = c.get("word", "")
                    if w:
                        try:
                            anki_results[w] = anki_connect.search_word_cached(
                                w, target_deck
                            )
                        except (RuntimeError, ValueError, httpx.HTTPError):
                            anki_results[w] = None

                previews = card_extraction.build_card_previews(
                    cards, target_deck, anki_results
                )
                for preview in previews:
                    q.put(sse_event({"type": "card_preview", "data": preview}))

            except (httpx.HTTPError, json.JSONDecodeError, ValueError, OSError) as e:
                words = ", ".join(p.get("word", "?") for p in chunk)
                log.error("Error generating chunk [%s]: %s", words, e)
                q.put(sse_event({
                    "type": "error",
                    "data": f"Failed to generate cards for: {words}",
                }))

        def worker() -> None:
            try:
                if os.environ.get("ANKI_DEFS_DEV"):
                    ai.reload_prompts()
                settings = get_settings()
                target_deck = deck or settings.get("defaultDeck", "Bangla")
                language = ai.get_language_for_deck(target_deck)
                transliteration = settings.get("showTransliteration", False)

                # Split into chunks and process concurrently
                chunks = [
                    pairs[i : i + CHUNK_SIZE]
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

                q.put(sse_event({"type": "done", "data": None}))
            except (RuntimeError, ValueError, OSError) as e:
                log.error("Photo generate worker error: %s", e, exc_info=True)
                q.put(sse_event({"type": "error", "data": str(e)}))
            finally:
                q.put(None)

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

        def stream() -> Iterator[str]:
            while True:
                item = q.get()
                if item is None:
                    break
                yield item

        return stream()
