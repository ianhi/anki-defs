"""Claude (Anthropic) AI provider using httpx."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from ..settings import get_settings

log = logging.getLogger(__name__)

CLAUDE_MODEL = "claude-sonnet-4-20250514"
API_URL = "https://api.anthropic.com/v1/messages"

_client: httpx.Client | None = None


def _get_client() -> tuple[httpx.Client, str]:
    global _client
    settings = get_settings()
    key = settings.get("claudeApiKey", "")
    if not key:
        raise ValueError("Claude API key not configured")
    if _client is None:
        log.debug("Creating client (key: ...%s)", key[-4:])
        _client = httpx.Client(timeout=60.0)
    return _client, key


def reset_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def stream_completion(
    system_prompt: str,
    user_message: str,
    on_text: Any,
    on_usage: Any,
    on_done: Any,
    on_error: Any,
) -> None:
    """Stream a Claude completion."""
    try:
        client, api_key = _get_client()
        input_tokens = 0
        output_tokens = 0
        model = CLAUDE_MODEL

        with client.stream(
            "POST",
            API_URL,
            json={
                "model": CLAUDE_MODEL,
                "max_tokens": 2048,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_message}],
                "stream": True,
            },
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
        ) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
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
    except (httpx.HTTPError, ValueError, OSError) as e:
        log.error("streamCompletion error: %s", e, exc_info=True)
        on_error(str(e))


def get_completion(system_prompt: str, user_message: str) -> str:
    """Get a non-streaming Claude completion."""
    client, api_key = _get_client()
    resp = client.post(
        API_URL,
        json={
            "model": CLAUDE_MODEL,
            "max_tokens": 2048,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
        },
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    resp.raise_for_status()
    result = resp.json()

    for block in result.get("content", []):
        if block.get("type") == "text":
            return block.get("text", "")
    return ""


def get_json_completion(
    system_prompt: str, user_message: str
) -> dict[str, Any]:
    """Get a non-streaming completion, returning text and usage."""
    client, api_key = _get_client()
    resp = client.post(
        API_URL,
        json={
            "model": CLAUDE_MODEL,
            "max_tokens": 2048,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
        },
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    resp.raise_for_status()
    result = resp.json()

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
            "model": result.get("model", CLAUDE_MODEL),
        }

    return {"text": text, "usage": usage}


# Claude doesn't use a JSON-specific mime type, so text and JSON completions are identical
get_text_completion = get_json_completion
