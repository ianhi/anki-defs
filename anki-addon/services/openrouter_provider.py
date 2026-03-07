"""OpenRouter AI provider using urllib.request (OpenAI-compatible API)."""

import json
import ssl
import urllib.request

from .settings_service import get_settings


def _get_config():
    settings = get_settings()
    key = settings.get("openRouterApiKey", "")
    if not key:
        raise ValueError("OpenRouter API key not configured")
    model = settings.get("openRouterModel", "google/gemini-2.5-flash")
    return key, model


def stream_completion(system_prompt, user_message, on_text, on_usage, on_done, on_error):
    """Stream an OpenRouter completion. Runs in a daemon thread."""
    try:
        api_key, model = _get_config()
        data = json.dumps(
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "max_tokens": 2048,
                "stream": True,
                "stream_options": {"include_usage": True},
            }
        ).encode("utf-8")

        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer {}".format(api_key),
            },
        )

        ctx = ssl.create_default_context()
        resp = urllib.request.urlopen(req, context=ctx)

        input_tokens = 0
        output_tokens = 0

        for line in _iter_sse_lines(resp):
            if not line.startswith("data: "):
                continue
            payload = line[6:]
            if payload.strip() == "[DONE]":
                break
            try:
                event = json.loads(payload)
            except json.JSONDecodeError:
                continue

            choices = event.get("choices", [])
            if choices:
                delta = choices[0].get("delta", {})
                text = delta.get("content", "")
                if text:
                    on_text(text)

            usage = event.get("usage")
            if usage:
                input_tokens = usage.get("prompt_tokens", input_tokens)
                output_tokens = usage.get("completion_tokens", output_tokens)

        if input_tokens or output_tokens:
            on_usage(
                {
                    "inputTokens": input_tokens,
                    "outputTokens": output_tokens,
                    "provider": "openrouter",
                    "model": model,
                }
            )
        on_done()
    except Exception as e:
        on_error(str(e))


def get_completion(system_prompt, user_message):
    """Get a non-streaming OpenRouter completion."""
    api_key, model = _get_config()
    data = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": 2048,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer {}".format(api_key),
        },
    )

    ctx = ssl.create_default_context()
    resp = urllib.request.urlopen(req, context=ctx)
    result = json.loads(resp.read().decode("utf-8"))

    choices = result.get("choices", [])
    if choices:
        return choices[0].get("message", {}).get("content", "")
    return ""


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
