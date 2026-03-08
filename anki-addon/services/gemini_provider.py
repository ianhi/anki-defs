"""Gemini (Google) AI provider using urllib.request."""

import json
import ssl
import urllib.request

from .settings_service import get_settings


def _get_config():
    settings = get_settings()
    key = settings.get("geminiApiKey", "")
    if not key:
        raise ValueError("Gemini API key not configured")
    model = settings.get("geminiModel", "gemini-2.5-flash-lite")
    return key, model


def stream_completion(system_prompt, user_message, on_text, on_usage, on_done, on_error):
    """Stream a Gemini completion. Runs in a daemon thread."""
    try:
        api_key, model = _get_config()
        url = "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}".format(
            model, api_key
        )

        data = json.dumps(
            {
                "system_instruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"parts": [{"text": user_message}]}],
                "generationConfig": {"maxOutputTokens": 2048},
            }
        ).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
        )

        ctx = ssl.create_default_context()
        resp = urllib.request.urlopen(req, context=ctx)

        input_tokens = 0
        output_tokens = 0

        for line in _iter_sse_lines(resp):
            if not line.startswith("data: "):
                continue
            payload = line[6:]
            try:
                event = json.loads(payload)
            except json.JSONDecodeError:
                continue

            # Extract text
            candidates = event.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                for part in parts:
                    text = part.get("text", "")
                    if text:
                        on_text(text)

            # Extract usage
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
    except Exception as e:
        on_error(str(e))


def get_completion(system_prompt, user_message):
    """Get a non-streaming Gemini completion."""
    api_key, model = _get_config()
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}".format(
            model, api_key
        )
    )

    data = json.dumps(
        {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_message}]}],
            "generationConfig": {"maxOutputTokens": 2048},
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
    )

    ctx = ssl.create_default_context()
    resp = urllib.request.urlopen(req, context=ctx)
    result = json.loads(resp.read().decode("utf-8"))

    candidates = result.get("candidates", [])
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        for part in parts:
            text = part.get("text", "")
            if text:
                return text
    return ""


def get_json_completion(system_prompt, user_message):
    """Get a non-streaming Gemini completion with JSON mime type.

    Uses responseMimeType: application/json for structured output.
    Returns dict with 'text' and optional 'usage' keys.
    """
    api_key, model = _get_config()
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}".format(
            model, api_key
        )
    )

    data = json.dumps(
        {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_message}]}],
            "generationConfig": {
                "maxOutputTokens": 2048,
                "responseMimeType": "application/json",
            },
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
    )

    ctx = ssl.create_default_context()
    resp = urllib.request.urlopen(req, context=ctx)
    result = json.loads(resp.read().decode("utf-8"))

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


def _iter_sse_lines(resp):
    """Iterate over SSE lines from an HTTP response."""
    buf = ""
    while True:
        chunk = resp.read(4096)
        if not chunk:
            break
        buf += chunk.decode("utf-8", errors="replace")
        while "\n" in buf:
            line, buf = buf.split("\n", 1)
            line = line.rstrip("\r")
            if line:
                yield line
