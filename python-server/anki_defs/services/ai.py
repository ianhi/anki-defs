"""AI provider abstraction and prompt management.

Loads all 6 prompt templates from shared/prompts/*.json. Implements selectPrompt()
logic matching Express ai.ts, plus provider dispatch to Claude/Gemini/OpenRouter.

Language resolution: each deck can map to a language via deckLanguages setting.
Deck hierarchy is walked (e.g. "A::B::C" checks "A::B::C", then "A::B", then "A")
before falling back to the global targetLanguage setting.
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

# --- Language loading ---


def _load_all_languages() -> dict[str, dict[str, Any]]:
    """Load all language files from shared/languages/."""
    langs: dict[str, dict[str, Any]] = {}
    if not LANGUAGES_DIR.exists():
        return langs
    for path in LANGUAGES_DIR.glob("*.json"):
        try:
            with open(path, encoding="utf-8") as f:
                lang = json.load(f)
                langs[lang["code"]] = lang
        except (json.JSONDecodeError, KeyError, OSError) as e:
            log.warning("Failed to load language file %s: %s", path, e)
    return langs


def _default_language(code: str, name: str) -> dict[str, Any]:
    """Generate a minimal language config for languages without a dedicated file."""
    return {
        "code": code,
        "name": name,
        "nativeName": name,
        "preamble": f"You are a {name} language expert helping a learner build Anki flashcards.",
        "lemmatizationRules": (
            "**Lemmatization**: Always use the dictionary/base form "
            "of the word, not the inflected form from the sentence."
        ),
        "spellingRules": "",
        "colloquialRules": "",
        "transliteration": {
            "instruction": {
                "true": (
                    f" Include romanized transliteration in parentheses"
                    f" after each {name} word."
                ),
                "false": " Do NOT include romanized transliteration/pronunciation.",
            },
            "marker": {"true": " ([transliteration])", "false": ""},
        },
        "lemmaExamples": {"inline": "", "relemmatize": "Use the dictionary/base form."},
        "sentenceAnalysis": {"skipParticles": ""},
        "translationGuidelines": (
            f"- Pick the MOST NATURAL {name} word \u2014 what a native speaker "
            f"would actually say in conversation.\n"
            f"- Prefer colloquial/spoken forms over formal/literary."
        ),
    }


def _resolve_language(code: str, settings: dict[str, Any]) -> dict[str, Any]:
    """Look up language by code -- file-backed first, then custom, then generate default."""
    if code in _languages:
        return _languages[code]
    # Check customLanguages setting
    for custom in settings.get("customLanguages", []):
        if custom.get("code") == code:
            return _default_language(code, custom["name"])
    # Generate from code alone
    return _default_language(code, code)


def _get_default_language() -> dict[str, Any]:
    """Get the default language (from targetLanguage setting)."""
    settings = get_settings()
    code = settings.get("targetLanguage", "bn")
    return _resolve_language(code, settings)


def get_language_for_deck(deck: str) -> dict[str, Any]:
    """Resolve language for a deck using :: hierarchy inheritance."""
    settings = get_settings()
    deck_langs = settings.get("deckLanguages", {})

    # Walk up deck hierarchy
    parts = deck.split("::")
    while parts:
        name = "::".join(parts)
        if name in deck_langs:
            code = deck_langs[name]
            return _resolve_language(code, settings)
        parts.pop()

    # Fallback to global targetLanguage
    code = settings.get("targetLanguage", "bn")
    return _resolve_language(code, settings)


def get_available_languages() -> list[dict[str, str]]:
    """Return list of available file-backed languages."""
    return [
        {"code": lang["code"], "name": lang["name"], "nativeName": lang.get("nativeName", "")}
        for lang in _languages.values()
    ]


# --- Prompt loading and rendering ---


def _load_json(filename: str) -> Any:
    """Load a JSON file from the shared prompts directory."""
    path = PROMPTS_DIR / filename
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _load_variables() -> dict[str, Any]:
    return _load_json("variables.json")


def _load_all_prompts() -> dict[str, Any]:
    return {
        "word": _load_json("single-word.json"),
        "focusedWords": _load_json("focused-words.json"),
        "relemmatize": _load_json("relemmatize.json"),
        "englishToBangla": _load_json("english-to-bangla.json"),
        "sentence": _load_json("sentence.json"),
        "distractors": _load_json("distractors.json"),
    }


# Cached at startup; reload_prompts() refreshes from disk
_variables: dict[str, Any] = _load_variables()
_languages: dict[str, dict[str, Any]] = _load_all_languages()
_prompt_templates: dict[str, Any] = _load_all_prompts()


def reload_prompts() -> None:
    """Reload prompt templates, variables, and languages from disk."""
    global _variables, _prompt_templates, _languages
    _variables = _load_variables()
    _languages = _load_all_languages()
    _prompt_templates = _load_all_prompts()


def _build_language_rules(lang: dict[str, Any]) -> str:
    """Build the languageRules string from a language config's component fields."""
    parts: list[str] = []
    name = lang.get("name", "")
    # Header
    parts.append(f"### {name}-Specific Rules\n")
    if lang.get("lemmatizationRules"):
        parts.append(lang["lemmatizationRules"])
    if lang.get("spellingRules"):
        parts.append("\n\n" + lang["spellingRules"])
    if lang.get("colloquialRules"):
        parts.append("\n\n" + lang["colloquialRules"])
    return "".join(parts)


def _render_prompt(
    template: str, transliteration: bool, language: dict[str, Any] | None = None
) -> str:
    """Apply variable substitutions to a prompt template.

    If a language is provided, its fields override the defaults from variables.json.
    """
    lang = language or _get_default_language()
    key = "true" if transliteration else "false"
    result = template

    # Language-aware substitutions
    result = result.replace("{{preamble}}", lang.get("preamble", _variables["preamble"]))
    result = result.replace("{{outputRules}}", _variables["outputRules"])

    # Build languageRules from language config if it has component fields,
    # otherwise fall back to variables.json
    if lang.get("lemmatizationRules") is not None:
        result = result.replace("{{languageRules}}", _build_language_rules(lang))
    else:
        result = result.replace("{{languageRules}}", _variables["languageRules"])

    # Transliteration from language config or variables.json
    translit = lang.get("transliteration", _variables["transliteration"])
    result = result.replace(
        "{{transliterationInstruction}}", translit["instruction"][key]
    )
    result = result.replace("{{translitMarker}}", translit["marker"][key])
    return result


def get_system_prompts(
    transliteration: bool, language: dict[str, Any] | None = None
) -> dict[str, str]:
    """Get rendered system prompts for all modes."""
    et = _prompt_templates["englishToBangla"]
    return {
        "word": _render_prompt(_prompt_templates["word"]["system"], transliteration, language),
        "focusedWords": _render_prompt(
            _prompt_templates["focusedWords"]["system"], transliteration, language
        ),
        "englishToBangla": _render_prompt(et["system"], transliteration, language),
        "englishToBanglaFocused": _render_prompt(
            et.get("system_focused", et["system"]), transliteration, language
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
    is_english_to_bangla = mode == "english-to-bangla"
    is_single_word = " " not in trimmed and len(trimmed) < 30
    has_highlights = bool(highlighted_words and len(highlighted_words) > 0)

    if is_english_to_bangla and has_highlights:
        assert highlighted_words is not None
        rendered = render_user_template(
            "englishToBangla",
            {"sentence": new_message, "highlightedWords": ", ".join(highlighted_words)},
            "focused",
        )
        return PromptSelection(
            mode="english-to-bangla-focused",
            system_prompt=prompts["englishToBanglaFocused"],
            user_message=(
                rendered
                or f"Sentence: {new_message}\n\nFocus words: {', '.join(highlighted_words)}"
            ),
        )

    if is_english_to_bangla:
        rendered = render_user_template(
            "englishToBangla",
            {"word": new_message, "userContext": user_context or ""},
        )
        return PromptSelection(
            mode="english-to-bangla",
            system_prompt=prompts["englishToBangla"],
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


def get_relemmatize_prompt(
    word: str, sentence: str | None = None, language: dict[str, Any] | None = None
) -> str:
    """Build the relemmatize prompt with word/context substitution."""
    context = f"\nContext sentence: {sentence}" if sentence else ""
    prompt = (
        _prompt_templates["relemmatize"]["system"]
        .replace("{{word}}", word)
        .replace("{{context}}", context)
    )
    # If a language is provided and has relemmatize rules, append them
    lang = language or _get_default_language()
    lemma_examples = lang.get("lemmaExamples", {})
    relemmatize_rules = lemma_examples.get("relemmatize", "")
    if relemmatize_rules and relemmatize_rules not in prompt:
        # The base relemmatize template already has Bangla rules baked in;
        # for non-default languages we could append, but for now the template
        # is language-specific enough. This hook is for future use.
        pass
    return prompt


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
