"""AI provider abstraction and prompt management.

Loads all 6 prompt templates from shared/prompts/*.json. Implements selectPrompt()
logic matching Express ai.ts, plus provider dispatch to Claude/Gemini/OpenRouter.

Language-specific content is loaded from shared/languages/<code>.json and substituted
into parameterized prompt templates at render time.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from ..config import LANGUAGES_DIR, PROMPTS_DIR
from . import providers
from .settings import get_settings

log = logging.getLogger(__name__)

# --- Prompt loading and rendering ---

def _load_json(filename: str, directory: Any = None) -> Any:
    """Load a JSON file from the given directory (defaults to prompts)."""
    path = (directory or PROMPTS_DIR) / filename
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _load_variables() -> dict[str, Any]:
    return _load_json("variables.json")


def _load_language(code: str) -> dict[str, Any]:
    """Load a language definition file from shared/languages/."""
    return _load_json(f"{code}.json", LANGUAGES_DIR)


def _build_language_rules(lang: dict[str, Any]) -> str:
    """Assemble the language-specific rules block from a language definition."""
    name = lang["name"]
    parts = [
        f"### {name}-Specific Rules\n",
        lang["lemmatizationRules"],
        "\n",
        lang["spellingRules"],
        "\n",
        lang["colloquialRules"],
    ]
    return "\n".join(parts)


def _load_all_prompts() -> dict[str, Any]:
    return {
        "word": _load_json("single-word.json"),
        "focusedWords": _load_json("focused-words.json"),
        "relemmatize": _load_json("relemmatize.json"),
        "englishToTarget": _load_json("english-to-target.json"),
        "sentence": _load_json("sentence.json"),
        "distractors": _load_json("distractors.json"),
    }


# Cached at startup; reload_prompts() refreshes from disk
_variables: dict[str, Any] = _load_variables()
_language: dict[str, Any] = _load_language(get_settings().get("targetLanguage", "bn"))
_prompt_templates: dict[str, Any] = _load_all_prompts()


def reload_prompts() -> None:
    """Reload prompt templates, variables, and language from disk."""
    global _variables, _prompt_templates, _language
    _variables = _load_variables()
    _language = _load_language(get_settings().get("targetLanguage", "bn"))
    _prompt_templates = _load_all_prompts()


def _render_prompt(template: str, transliteration: bool) -> str:
    """Apply variable and language substitutions to a prompt template."""
    key = "true" if transliteration else "false"
    result = template
    # Language substitutions
    result = result.replace("{{preamble}}", _language["preamble"])
    result = result.replace("{{targetLanguage}}", _language["name"])
    result = result.replace("{{languageRules}}", _build_language_rules(_language))
    result = result.replace(
        "{{transliterationInstruction}}", _language["transliteration"]["instruction"][key]
    )
    result = result.replace("{{translitMarker}}", _language["transliteration"]["marker"][key])
    result = result.replace("{{lemmaExample}}", _language["lemmaExamples"]["inline"])
    result = result.replace("{{relemmatizeRules}}", _language["lemmaExamples"]["relemmatize"])
    result = result.replace("{{skipParticles}}", _language["sentenceAnalysis"]["skipParticles"])
    result = result.replace("{{translationGuidelines}}", _language["translationGuidelines"])
    # Global substitutions
    result = result.replace("{{outputRules}}", _variables["outputRules"])
    return result


def get_system_prompts(transliteration: bool) -> dict[str, str]:
    """Get rendered system prompts for all modes."""
    et = _prompt_templates["englishToTarget"]
    return {
        "word": _render_prompt(_prompt_templates["word"]["system"], transliteration),
        "focusedWords": _render_prompt(
            _prompt_templates["focusedWords"]["system"], transliteration
        ),
        "englishToTarget": _render_prompt(et["system"], transliteration),
        "englishToTargetFocused": _render_prompt(
            et.get("system_focused", et["system"]), transliteration
        ),
    }


def render_user_template(
    template_key: str,
    variables: dict[str, str],
    variant: str | None = None,
) -> str | None:
    """Render a user_template from a prompt file with variable substitution."""
    template = _prompt_templates.get(template_key)
    if not template:
        return None

    if variant == "focused" and template.get("user_template_focused"):
        template_str = template["user_template_focused"]
    elif template.get("user_template"):
        template_str = template["user_template"]
    else:
        return None

    result = template_str
    result = result.replace("{{word}}", variables.get("word", ""))
    user_context = variables.get("userContext", "")
    if user_context:
        result = result.replace("{{userContext}}", f"\n\n(User note: {user_context})")
    else:
        result = result.replace("{{userContext}}", "")
    result = result.replace("{{sentence}}", variables.get("sentence", ""))
    result = result.replace("{{highlightedWords}}", variables.get("highlightedWords", ""))
    return result


class PromptSelection:
    __slots__ = ("mode", "system_prompt", "user_message")

    def __init__(self, mode: str, system_prompt: str, user_message: str) -> None:
        self.mode = mode
        self.system_prompt = system_prompt
        self.user_message = user_message


def select_prompt(
    prompts: dict[str, str],
    new_message: str,
    *,
    highlighted_words: list[str] | None = None,
    user_context: str | None = None,
    mode: str | None = None,
) -> PromptSelection:
    """Classify input and select the appropriate prompt + user message.

    Matches Express selectPrompt() logic exactly.
    """
    trimmed = new_message.strip()
    is_english_to_target = mode == "english-to-target"
    is_single_word = " " not in trimmed and len(trimmed) < 30
    has_highlights = bool(highlighted_words and len(highlighted_words) > 0)

    if is_english_to_target and has_highlights:
        assert highlighted_words is not None
        rendered = render_user_template(
            "englishToTarget",
            {"sentence": new_message, "highlightedWords": ", ".join(highlighted_words)},
            "focused",
        )
        return PromptSelection(
            mode="english-to-target-focused",
            system_prompt=prompts["englishToTargetFocused"],
            user_message=(
                rendered
                or f"Sentence: {new_message}\n\nFocus words: {', '.join(highlighted_words)}"
            ),
        )

    if is_english_to_target:
        rendered = render_user_template(
            "englishToTarget",
            {"word": new_message, "userContext": user_context or ""},
        )
        return PromptSelection(
            mode="english-to-target",
            system_prompt=prompts["englishToTarget"],
            user_message=rendered or new_message,
        )

    if has_highlights:
        assert highlighted_words is not None
        rendered = render_user_template(
            "focusedWords",
            {"sentence": new_message, "highlightedWords": ", ".join(highlighted_words)},
        )
        return PromptSelection(
            mode="focused-words",
            system_prompt=prompts["focusedWords"],
            user_message=(
                rendered
                or f"Sentence: {new_message}\n\nFocus words: {', '.join(highlighted_words)}"
            ),
        )

    if is_single_word:
        rendered = render_user_template(
            "word",
            {"word": new_message, "userContext": user_context or ""},
        )
        return PromptSelection(
            mode="single-word",
            system_prompt=prompts["word"],
            user_message=rendered or new_message,
        )

    return PromptSelection(
        mode="sentence-blocked",
        system_prompt="",
        user_message=new_message,
    )


def get_relemmatize_prompt(word: str, sentence: str | None = None) -> str:
    """Build the relemmatize prompt with word/context and language substitution."""
    context = f"\nContext sentence: {sentence}" if sentence else ""
    raw = (
        _prompt_templates["relemmatize"]["system"]
        .replace("{{word}}", word)
        .replace("{{context}}", context)
    )
    # Apply language substitutions
    raw = raw.replace("{{targetLanguage}}", _language["name"])
    raw = raw.replace("{{relemmatizeRules}}", _language["lemmaExamples"]["relemmatize"])
    return raw


def get_distractor_prompt(word: str, sentence: str, definition: str) -> tuple[str, str]:
    """Build the distractor generation prompt.

    Returns (system_prompt, user_message) tuple.
    """
    template = _prompt_templates["distractors"]
    system_prompt = template["system"]
    user_message = (
        template["user_template"]
        .replace("{{word}}", word)
        .replace("{{sentence}}", sentence)
        .replace("{{definition}}", definition)
    )
    return system_prompt, user_message


# --- Provider dispatch ---

def _get_provider_module() -> Any:
    """Get the provider module based on current settings."""
    settings = get_settings()
    provider = settings.get("aiProvider", "claude")
    if provider == "claude":
        return providers.claude
    elif provider == "openrouter":
        return providers.openrouter
    else:
        return providers.gemini


def _provider_name() -> str:
    return get_settings().get("aiProvider", "claude")


def stream_completion(
    system_prompt: str,
    user_message: str,
    on_text: Any,
    on_usage: Any,
    on_done: Any,
    on_error: Any,
) -> None:
    log.debug("streamCompletion using provider: %s", _provider_name())
    provider = _get_provider_module()
    provider.stream_completion(system_prompt, user_message, on_text, on_usage, on_done, on_error)


def get_completion(system_prompt: str, user_message: str) -> str:
    log.debug("getCompletion using provider: %s", _provider_name())
    provider = _get_provider_module()
    return provider.get_completion(system_prompt, user_message)


def get_json_completion(system_prompt: str, user_message: str) -> dict[str, Any]:
    log.debug("getJsonCompletion using provider: %s", _provider_name())
    provider = _get_provider_module()
    return provider.get_json_completion(system_prompt, user_message)


def reset_clients() -> None:
    providers.claude.reset_client()
    providers.gemini.reset_client()
    providers.openrouter.reset_client()


def parse_json_response(raw: str) -> Any:
    """Strip markdown code fences and parse JSON."""
    stripped = re.sub(r"^```(?:json)?\s*\n?", "", raw, count=1)
    stripped = re.sub(r"\n?```\s*$", "", stripped, count=1)
    return json.loads(stripped)
