"""Gemini (Google) AI provider using httpx."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from ..settings import get_settings

log = logging.getLogger(__name__)

_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

_client: httpx.Client | None = None


def _get_config() -> tuple[httpx.Client, str, str]:
    global _client
    settings = get_settings()
    key = settings.get("geminiApiKey", "")
    if not key:
        raise ValueError("Gemini API key not configured")
    model = settings.get("geminiModel", "gemini-2.5-flash-lite")
    if _client is None:
        log.debug("Creating client (key ends ...%s)", key[-4:])
        _client = httpx.Client(timeout=60.0)
    return _client, key, model


def reset_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def _build_body(system_prompt: str, user_message: str, **extra: Any) -> dict[str, Any]:
    return {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_message}]}],
        "generationConfig": {"maxOutputTokens": 2048, **extra},
    }


def stream_completion(
    system_prompt: str,
    user_message: str,
    on_text: Any,
    on_usage: Any,
    on_done: Any,
    on_error: Any,
) -> None:
    """Stream a Gemini completion."""
    try:
        client, api_key, model = _get_config()
        url = f"{_BASE_URL}/{model}:streamGenerateContent?alt=sse&key={api_key}"

        with client.stream(
            "POST",
            url,
            json=_build_body(system_prompt, user_message),
            headers={"Content-Type": "application/json"},
        ) as resp:
            resp.raise_for_status()
            input_tokens = 0
            output_tokens = 0

            for line in resp.iter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[6:]
                try:
                    event = json.loads(payload)
                except json.JSONDecodeError:
                    continue

                candidates = event.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    for part in parts:
                        text = part.get("text", "")
                        if text:
                            on_text(text)

                usage_meta = event.get("usageMetadata", {})
                if usage_meta:
                    input_tokens = usage_meta.get("promptTokenCount", input_tokens)
                    output_tokens = usage_meta.get("candidatesTokenCount", output_tokens)

        if input_tokens or output_tokens:
            on_usage(
                {
                    "inputTokens": input_tokens,
                    "outputTokens": output_tokens,
                    "provider": "gemini",
                    "model": model,
                }
            )
        on_done()
    except (httpx.HTTPError, ValueError, OSError) as e:
        log.error("Stream error: %s", e, exc_info=True)
        on_error(str(e))


def get_completion(system_prompt: str, user_message: str) -> str:
    """Get a non-streaming Gemini completion."""
    client, api_key, model = _get_config()
    url = f"{_BASE_URL}/{model}:generateContent?key={api_key}"

    resp = client.post(
        url,
        json=_build_body(system_prompt, user_message),
        headers={"Content-Type": "application/json"},
    )
    resp.raise_for_status()
    result = resp.json()

    candidates = result.get("candidates", [])
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        for part in parts:
            text = part.get("text", "")
            if text:
                return text
    return ""


def get_json_completion(
    system_prompt: str, user_message: str
) -> dict[str, Any]:
    """Get a non-streaming completion with JSON mime type."""
    client, api_key, model = _get_config()
    url = f"{_BASE_URL}/{model}:generateContent?key={api_key}"

    resp = client.post(
        url,
        json=_build_body(system_prompt, user_message, responseMimeType="application/json"),
        headers={"Content-Type": "application/json"},
    )
    resp.raise_for_status()
    result = resp.json()

    text = ""
    candidates = result.get("candidates", [])
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        for part in parts:
            t = part.get("text", "")
            if t:
                text = t
                break

    usage = None
    usage_meta = result.get("usageMetadata", {})
    if usage_meta:
        usage = {
            "inputTokens": usage_meta.get("promptTokenCount", 0),
            "outputTokens": usage_meta.get("candidatesTokenCount", 0),
            "provider": "gemini",
            "model": model,
        }

    return {"text": text, "usage": usage}
