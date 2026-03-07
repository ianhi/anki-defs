"""AI provider abstraction -- delegates to Claude, Gemini, or OpenRouter.

Prompt templates are loaded from shared/prompts/*.json (the cross-backend
source of truth). Variables like {{lemmaRules}} and {{transliterationInstruction}}
are substituted at runtime based on user settings.
"""

import json
import os

from . import claude_provider, gemini_provider, openrouter_provider
from .settings_service import get_settings

_PROMPTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "shared",
    "prompts",
)


def _load_json(filename):
    """Load a JSON file from the shared prompts directory."""
    path = os.path.join(_PROMPTS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_provider_module():
    """Get the provider module based on current settings."""
    settings = get_settings()
    provider = settings.get("aiProvider", "claude")
    if provider == "claude":
        return claude_provider
    elif provider == "openrouter":
        return openrouter_provider
    else:
        return gemini_provider


def stream_completion(system_prompt, user_message, on_text, on_usage, on_done, on_error):
    """Stream a completion. Callbacks: on_text(str), on_usage(dict), on_done(), on_error(str).

    This is called from a daemon thread for SSE streaming.
    """
    provider = get_provider_module()
    provider.stream_completion(system_prompt, user_message, on_text, on_usage, on_done, on_error)


def get_completion(system_prompt, user_message):
    """Get a non-streaming completion. Returns the response text."""
    provider = get_provider_module()
    return provider.get_completion(system_prompt, user_message)


def get_system_prompts(transliteration):
    """Load and render system prompts from shared/prompts/*.json.

    Substitutes {{lemmaRules}}, {{transliterationInstruction}}, and
    {{translitMarker}} variables based on the transliteration setting.
    """
    variables = _load_json("variables.json")

    # Build substitution map
    translit_key = "true" if transliteration else "false"
    subs = {
        "{{lemmaRules}}": variables["lemmaRules"],
        "{{transliterationInstruction}}": variables["transliteration"]["instruction"][translit_key],
        "{{translitMarker}}": variables["transliteration"]["marker"][translit_key],
    }

    def _render(template):
        """Apply variable substitutions to a template string."""
        result = template
        for key, value in subs.items():
            result = result.replace(key, value)
        return result

    # Load each prompt template and render
    word_prompt = _load_json("single-word.json")
    sentence_prompt = _load_json("sentence.json")
    focused_prompt = _load_json("focused-words.json")
    extract_prompt = _load_json("card-extraction.json")
    define_prompt = _load_json("define.json")
    analyze_prompt = _load_json("analyze.json")

    return {
        "word": _render(word_prompt["system"]),
        "sentence": _render(sentence_prompt["system"]),
        "focusedWords": _render(focused_prompt["system"]),
        "extractCard": _render(extract_prompt["system"]),
        "define": _render(define_prompt["system"]),
        "analyze": _render(analyze_prompt["system"]),
    }
