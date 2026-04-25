"""Google Cloud Text-to-Speech provider using httpx.

Generates MP3 audio for text in a given locale.  Used during card creation
to embed pronunciation audio.  Shared between python-server and anki-addon
(copied at build time by build-addon.sh).
"""

from __future__ import annotations

import base64
import hashlib
import logging
from typing import Any

import httpx

from ..settings import get_settings

log = logging.getLogger(__name__)

_SYNTHESIZE_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
_VOICES_URL = "https://texttospeech.googleapis.com/v1/voices"

_client: httpx.Client | None = None


def _get_client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(timeout=30.0)
    return _client


def reset_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def is_enabled(settings: dict[str, Any] | None = None) -> bool:
    """Check if TTS is enabled and a Gemini API key is configured."""
    if settings is None:
        settings = get_settings()
    return bool(settings.get("ttsEnabled")) and bool(settings.get("geminiApiKey"))


def check_available(api_key: str) -> dict[str, object]:
    """Validate that Cloud TTS is enabled for this API key.

    Calls the lightweight ``voices.list`` endpoint (no audio generated, no cost).

    Returns:
        ``{"available": True, "voiceCount": N}`` on success, or
        ``{"available": False, "error": "..."}`` on failure.
    """
    client = _get_client()
    try:
        resp = client.get(_VOICES_URL, params={"key": api_key})
        if resp.status_code == 200:
            voices = resp.json().get("voices", [])
            return {"available": True, "voiceCount": len(voices)}
        is_json = resp.headers.get("content-type", "").startswith("application/json")
        body = resp.json() if is_json else {}
        error_msg = body.get("error", {}).get("message", resp.text[:200])
        return {"available": False, "error": error_msg}
    except httpx.HTTPError as exc:
        return {"available": False, "error": str(exc)}


def audio_filename(text: str, locale: str) -> str:
    """Deterministic filename for dedup: ``anki-defs-{md5}.mp3``."""
    digest = hashlib.md5(f"{text}|{locale}".encode()).hexdigest()
    return f"anki-defs-{digest}.mp3"


def synthesize(text: str, locale: str, api_key: str) -> bytes:
    """Call Google Cloud TTS and return raw MP3 bytes.

    Args:
        text: The text to speak (a word or sentence).
        locale: BCP-47 language code (e.g. ``"bn-IN"``, ``"es-US"``).
        api_key: Google Cloud API key with Cloud TTS enabled.

    Returns:
        MP3 audio bytes (24 kHz, mono).

    Raises:
        httpx.HTTPStatusError: On API error (4xx/5xx).
    """
    client = _get_client()
    body = {
        "input": {"text": text},
        "voice": {"languageCode": locale},
        "audioConfig": {
            "audioEncoding": "MP3",
            "sampleRateHertz": 24000,
        },
    }
    resp = client.post(
        _SYNTHESIZE_URL,
        params={"key": api_key},
        json=body,
    )
    resp.raise_for_status()
    audio_b64 = resp.json()["audioContent"]
    return base64.b64decode(audio_b64)
