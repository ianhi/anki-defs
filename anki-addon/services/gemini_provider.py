"""Gemini (Google) AI provider using urllib.request."""

import json
import urllib.request
import ssl
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

        data = json.dumps({
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_message}]}],
            "generationConfig": {"maxOutputTokens": 2048},
        }).encode("utf-8")

        req = urllib.request.Request(
            url, data=data,
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
            on_usage({
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "provider": "gemini",
                "model": model,
            })
        on_done()
    except Exception as e:
        on_error(str(e))


def get_completion(system_prompt, user_message):
    """Get a non-streaming Gemini completion."""
    api_key, model = _get_config()
    url = "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}".format(
        model, api_key
    )

    data = json.dumps({
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_message}]}],
        "generationConfig": {"maxOutputTokens": 2048},
    }).encode("utf-8")

    req = urllib.request.Request(
        url, data=data,
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


def extract_card_data(word, explanation):
    """Extract card data using Gemini structured output (JSON mode)."""
    api_key, model = _get_config()
    url = "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}".format(
        model, api_key
    )

    prompt = 'Extract flashcard data from this explanation of the Bangla word "{}":\n\n{}'.format(
        word, explanation
    )

    data = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "word": {"type": "STRING"},
                    "definition": {"type": "STRING"},
                    "exampleSentence": {"type": "STRING"},
                    "sentenceTranslation": {"type": "STRING"},
                },
                "required": ["word", "definition", "exampleSentence", "sentenceTranslation"],
            },
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        url, data=data,
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
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    pass
    return {"word": word, "definition": "", "exampleSentence": "", "sentenceTranslation": ""}


def extract_card_data_from_sentence(word, original_sentence, sentence_translation, explanation):
    """Extract card data for a word in sentence context."""
    api_key, model = _get_config()
    url = "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}".format(
        model, api_key
    )

    prompt = 'Extract the definition for the Bangla word "{}" from this explanation:\n\n{}\n\nThe example sentence is already provided: "{}"'.format(
        word, explanation, original_sentence
    )

    data = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "word": {"type": "STRING"},
                    "definition": {"type": "STRING"},
                },
                "required": ["word", "definition"],
            },
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
    )

    ctx = ssl.create_default_context()
    resp = urllib.request.urlopen(req, context=ctx)
    result = json.loads(resp.read().decode("utf-8"))

    parsed = {"word": word, "definition": ""}
    candidates = result.get("candidates", [])
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        for part in parts:
            text = part.get("text", "")
            if text:
                try:
                    parsed = json.loads(text)
                except json.JSONDecodeError:
                    pass

    return {
        "word": parsed.get("word", word),
        "definition": parsed.get("definition", ""),
        "exampleSentence": original_sentence,
        "sentenceTranslation": sentence_translation,
    }


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
