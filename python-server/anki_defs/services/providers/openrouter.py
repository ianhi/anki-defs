"""OpenRouter AI provider using httpx (OpenAI-compatible API)."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ..settings import get_settings

API_URL = "https://openrouter.ai/api/v1/chat/completions"

_client: httpx.Client | None = None


def _get_config() -> tuple[httpx.Client, str, str]:
    global _client
    settings = get_settings()
    key = settings.get("openRouterApiKey", "")
    if not key:
        raise ValueError("OpenRouter API key not configured")
    model = settings.get("openRouterModel", "google/gemini-2.5-flash")
    if _client is None:
        print(f"[OpenRouter] Creating client (key ends ...{key[-4:]})")
        _client = httpx.Client(timeout=60.0)
    return _client, key, model


def reset_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def _build_messages(system_prompt: str, user_message: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]


def stream_completion(
    system_prompt: str,
    user_message: str,
    on_text: Any,
    on_usage: Any,
    on_done: Any,
    on_error: Any,
) -> None:
    """Stream an OpenRouter completion."""
    try:
        client, api_key, model = _get_config()

        with client.stream(
            "POST",
            API_URL,
            json={
                "model": model,
                "messages": _build_messages(system_prompt, user_message),
                "max_tokens": 2048,
                "stream": True,
                "stream_options": {"include_usage": True},
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
        ) as resp:
            resp.raise_for_status()
            input_tokens = 0
            output_tokens = 0

            for line in resp.iter_lines():
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
        print(f"[OpenRouter] Stream error: {e}")
        on_error(str(e))


def get_completion(system_prompt: str, user_message: str) -> str:
    """Get a non-streaming OpenRouter completion."""
    client, api_key, model = _get_config()
    resp = client.post(
        API_URL,
        json={
            "model": model,
            "messages": _build_messages(system_prompt, user_message),
            "max_tokens": 2048,
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    resp.raise_for_status()
    result = resp.json()

    choices = result.get("choices", [])
    if choices:
        return choices[0].get("message", {}).get("content", "")
    return ""


def get_json_completion(
    system_prompt: str, user_message: str
) -> dict[str, Any]:
    """Get a non-streaming completion, returning text and usage."""
    client, api_key, model = _get_config()
    resp = client.post(
        API_URL,
        json={
            "model": model,
            "messages": _build_messages(system_prompt, user_message),
            "max_tokens": 2048,
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    resp.raise_for_status()
    result = resp.json()

    text = ""
    choices = result.get("choices", [])
    if choices:
        text = choices[0].get("message", {}).get("content", "")

    usage = None
    usage_data = result.get("usage")
    if usage_data:
        usage = {
            "inputTokens": usage_data.get("prompt_tokens", 0),
            "outputTokens": usage_data.get("completion_tokens", 0),
            "provider": "openrouter",
            "model": model,
        }

    return {"text": text, "usage": usage}
