"""AI provider abstraction -- delegates to Claude, Gemini, or OpenRouter.

Prompt templates are loaded from shared/prompts/*.json (the cross-backend
source of truth). Variables like {{preamble}} and {{transliterationInstruction}}
are substituted at runtime based on user settings.
"""

import json
import os
import re

from . import claude_provider, gemini_provider, openrouter_provider
from .settings_service import get_settings

_ADDON_DIR = os.path.dirname(os.path.dirname(__file__))

# Packaged addon has _shared/ inside the addon dir; dev install uses repo-relative path.
_SHARED_PACKAGED = os.path.join(_ADDON_DIR, "_shared", "prompts")
_SHARED_REPO = os.path.join(os.path.dirname(_ADDON_DIR), "shared", "prompts")
_PROMPTS_DIR = _SHARED_PACKAGED if os.path.isdir(_SHARED_PACKAGED) else _SHARED_REPO


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


def get_completion(system_prompt, user_message):
    """Get a non-streaming completion. Returns the response text."""
    provider = get_provider_module()
    return provider.get_completion(system_prompt, user_message)


def get_json_completion(system_prompt, user_message):
    """Get a non-streaming JSON completion. Returns dict with 'text' and optional 'usage'."""
    provider = get_provider_module()
    return provider.get_json_completion(system_prompt, user_message)


def parse_json_response(raw):
    """Strip markdown code fences and parse JSON.

    Returns the parsed object/array on success.
    Raises ValueError/json.JSONDecodeError on failure.
    """
    stripped = re.sub(r"^```(?:json)?\s*\n?", "", raw, count=1)
    stripped = re.sub(r"\n?```\s*$", "", stripped, count=1)
    return json.loads(stripped)


def get_system_prompts(transliteration):
    """Load and render system prompts from shared/prompts/*.json.

    Substitutes {{preamble}}, {{outputRules}}, {{languageRules}},
    {{transliterationInstruction}}, and {{translitMarker}} variables.
    """
    variables = _load_json("variables.json")

    # Build substitution map
    translit_key = "true" if transliteration else "false"
    subs = {
        "{{preamble}}": variables["preamble"],
        "{{outputRules}}": variables["outputRules"],
        "{{languageRules}}": variables["languageRules"],
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
    focused_prompt = _load_json("focused-words.json")

    return {
        "word": _render(word_prompt["system"]),
        "focusedWords": _render(focused_prompt["system"]),
    }


def _load_prompt_templates():
    """Load prompt templates (with user_template fields)."""
    return {
        "word": _load_json("single-word.json"),
        "focusedWords": _load_json("focused-words.json"),
    }


def render_user_template(template_key, variables):
    """Render a user_template from a prompt file with variable substitution.

    template_key: 'word' or 'focusedWords'
    variables: dict with optional keys: word, userContext, sentence, highlightedWords
    Returns the rendered string, or None if no user_template.
    """
    templates = _load_prompt_templates()
    template = templates.get(template_key)
    if not template or not template.get("user_template"):
        return None

    result = template["user_template"]
    result = result.replace("{{word}}", variables.get("word", ""))
    user_context = variables.get("userContext", "")
    if user_context:
        result = result.replace("{{userContext}}", "\n\n(User note: {})".format(user_context))
    else:
        result = result.replace("{{userContext}}", "")
    result = result.replace("{{sentence}}", variables.get("sentence", ""))
    result = result.replace("{{highlightedWords}}", variables.get("highlightedWords", ""))
    return result
