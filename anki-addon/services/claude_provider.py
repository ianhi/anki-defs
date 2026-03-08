"""Claude (Anthropic) AI provider using urllib.request."""

import json
import ssl
import urllib.request

from .settings_service import get_settings


def _get_api_key():
    settings = get_settings()
    key = settings.get("claudeApiKey", "")
    if not key:
        raise ValueError("Claude API key not configured")
    return key


def stream_completion(system_prompt, user_message, on_text, on_usage, on_done, on_error):
    """Stream a Claude completion. Runs in a daemon thread."""
    try:
        api_key = _get_api_key()
        data = json.dumps(
            {
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 2048,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_message}],
                "stream": True,
            }
        ).encode("utf-8")

        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=data,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
        )

        ctx = ssl.create_default_context()
        resp = urllib.request.urlopen(req, context=ctx)

        input_tokens = 0
        output_tokens = 0
        model = "claude-sonnet-4-20250514"

        for line in _iter_sse_lines(resp):
            if not line.startswith("data: "):
                continue
            payload = line[6:]
            if payload == "[DONE]":
                break
            try:
                event = json.loads(payload)
            except json.JSONDecodeError:
                continue

            event_type = event.get("type", "")
            if event_type == "content_block_delta":
                delta = event.get("delta", {})
                if delta.get("type") == "text_delta":
                    on_text(delta.get("text", ""))
            elif event_type == "message_delta":
                usage = event.get("usage", {})
                output_tokens = usage.get("output_tokens", output_tokens)
            elif event_type == "message_start":
                msg = event.get("message", {})
                model = msg.get("model", model)
                usage = msg.get("usage", {})
                input_tokens = usage.get("input_tokens", 0)

        if input_tokens or output_tokens:
            on_usage(
                {
                    "inputTokens": input_tokens,
                    "outputTokens": output_tokens,
                    "provider": "claude",
                    "model": model,
                }
            )
        on_done()
    except Exception as e:
        on_error(str(e))


def get_completion(system_prompt, user_message):
    """Get a non-streaming Claude completion."""
    api_key = _get_api_key()
    data = json.dumps(
        {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 2048,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=data,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )

    ctx = ssl.create_default_context()
    resp = urllib.request.urlopen(req, context=ctx)
    result = json.loads(resp.read().decode("utf-8"))

    for block in result.get("content", []):
        if block.get("type") == "text":
            return block.get("text", "")
    return ""


def get_json_completion(system_prompt, user_message):
    """Get a non-streaming Claude completion, returning text and usage.

    Returns dict with 'text' and optional 'usage' keys.
    """
    api_key = _get_api_key()
    data = json.dumps(
        {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 2048,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=data,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )

    ctx = ssl.create_default_context()
    resp = urllib.request.urlopen(req, context=ctx)
    result = json.loads(resp.read().decode("utf-8"))

    text = ""
    for block in result.get("content", []):
        if block.get("type") == "text":
            text = block.get("text", "")
            break

    usage = None
    usage_data = result.get("usage", {})
    if usage_data:
        usage = {
            "inputTokens": usage_data.get("input_tokens", 0),
            "outputTokens": usage_data.get("output_tokens", 0),
            "provider": "claude",
            "model": result.get("model", "claude-sonnet-4-20250514"),
        }

    return {"text": text, "usage": usage}


def _iter_sse_lines(resp):
    """Iterate over SSE lines from an HTTP response, handling chunked data."""
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
