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
    """Look up language by code -- file-backed first, then custom, then generate default.

    Falls back through BCP-47 variants: a regional code like ``es-MX`` will
    fall back to the bare language ``es`` if no region-specific file exists.
    """
    if code in _languages:
        return _languages[code]
    # Fallback: strip region subtag (es-MX -> es).
    if "-" in code:
        base = code.split("-", 1)[0]
        if base in _languages:
            return _languages[base]
    for custom in settings.get("customLanguages", []):
        if custom.get("code") == code:
            return _default_language(code, custom["name"])
    return _default_language(code, code)


def _get_default_language() -> dict[str, Any]:
    """Get the default language (from targetLanguage setting)."""
    settings = get_settings()
    code = settings.get("targetLanguage", "bn")
    return _resolve_language(code, settings)


def get_language_by_code(code: str) -> dict[str, Any] | None:
    """Look up a language by code, returning None if not found."""
    settings = get_settings()
    lang = _resolve_language(code, settings)
    # _resolve_language always returns a dict (falls back to default),
    # but we return None if the code doesn't match any known language file
    # and isn't in customLanguages.
    if code not in _languages and not any(
        c.get("code") == code for c in settings.get("customLanguages", [])
    ):
        # Check base code for regional variants (es-MX → es)
        base = code.split("-", 1)[0] if "-" in code else ""
        if base and base not in _languages:
            return None
    return lang


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
        {
            "code": lang["code"],
            "name": lang["name"],
            "nativeName": lang.get("nativeName", ""),
            "script": lang.get("script", "latin"),
        }
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
        "photoExtract": _load_json("photo-extract.json"),
        "photoGenerate": _load_json("photo-generate.json"),
        "pdfScout": _load_json("pdf-scout.json"),
        "pdfVocabExtract": _load_json("pdf-vocab-extract.json"),
        "pdfPassageExtract": _load_json("pdf-passage-extract.json"),
        "photoClozeTranscribe": _load_json("photo-cloze-transcribe.json"),
        "photoClozeExtract": _load_json("photo-cloze-extract.json"),
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


def _render_prompt(
    template: str, transliteration: bool, language: dict[str, Any] | None = None
) -> str:
    """Apply variable and language substitutions to a prompt template."""
    lang = language or _get_default_language()
    key = "true" if transliteration else "false"
    result = template
    # Language substitutions
    result = result.replace("{{preamble}}", lang["preamble"])
    result = result.replace("{{targetLanguage}}", lang["name"])
    result = result.replace("{{languageRules}}", _build_language_rules(lang))
    translit = lang.get("transliteration", {})
    result = result.replace(
        "{{transliterationInstruction}}", translit.get("instruction", {}).get(key, "")
    )
    result = result.replace("{{translitMarker}}", translit.get("marker", {}).get(key, ""))
    result = result.replace("{{lemmaExample}}", lang.get("lemmaExamples", {}).get("inline", ""))
    lemma_ex = lang.get("lemmaExamples", {})
    result = result.replace("{{relemmatizeRules}}", lemma_ex.get("relemmatize", ""))
    sentence_cfg = lang.get("sentenceAnalysis", {})
    result = result.replace("{{skipParticles}}", sentence_cfg.get("skipParticles", ""))
    result = result.replace("{{translationGuidelines}}", lang.get("translationGuidelines", ""))
    result = result.replace("{{phraseRules}}", lang.get("phraseRules", ""))
    result = result.replace("{{clozeExtractionRules}}", lang.get("clozeExtractionRules", ""))
    # Global substitutions
    result = result.replace("{{outputRules}}", _variables["outputRules"])
    result = result.replace("{{jsonOutputRule}}", _variables.get("jsonOutputRule", ""))
    return result


def get_system_prompts(
    transliteration: bool, language: dict[str, Any] | None = None
) -> dict[str, str]:
    """Get rendered system prompts for all modes."""
    et = _prompt_templates["englishToTarget"]
    return {
        "word": _render_prompt(_prompt_templates["word"]["system"], transliteration, language),
        "focusedWords": _render_prompt(
            _prompt_templates["focusedWords"]["system"], transliteration, language
        ),
        "englishToTarget": _render_prompt(et["system"], transliteration, language),
        "englishToTargetFocused": _render_prompt(
            et.get("system_focused", et["system"]), transliteration, language
        ),
        "sentence": _render_prompt(
            _prompt_templates["sentence"]["system"], transliteration, language
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

    rendered = render_user_template(
        "sentence",
        {"sentence": new_message, "userContext": user_context or ""},
    )
    return PromptSelection(
        mode="sentence-translate",
        system_prompt=prompts["sentence"],
        user_message=rendered or new_message,
    )


def get_relemmatize_prompt(
    word: str, sentence: str | None = None, language: dict[str, Any] | None = None
) -> str:
    """Build the relemmatize prompt with word/context and language substitution."""
    lang = language or _get_default_language()
    context = f"\nContext sentence: {sentence}" if sentence else ""
    raw = (
        _prompt_templates["relemmatize"]["system"]
        .replace("{{word}}", word)
        .replace("{{context}}", context)
    )
    # Apply language substitutions
    raw = raw.replace("{{targetLanguage}}", lang["name"])
    raw = raw.replace("{{relemmatizeRules}}", lang.get("lemmaExamples", {}).get("relemmatize", ""))
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


def get_json_completion(
    system_prompt: str,
    user_message: str,
    *,
    max_output_tokens: int = 4096,
) -> dict[str, Any]:
    log.debug("getJsonCompletion using provider: %s", _provider_name())
    provider = _get_provider_module()
    return provider.get_json_completion(
        system_prompt, user_message, max_output_tokens=max_output_tokens
    )


def get_text_completion(system_prompt: str, user_message: str) -> dict[str, Any]:
    log.debug("getTextCompletion using provider: %s", _provider_name())
    provider = _get_provider_module()
    return provider.get_text_completion(system_prompt, user_message)


def reset_clients() -> None:
    providers.claude.reset_client()
    providers.gemini.reset_client()
    providers.openrouter.reset_client()
    providers.tts.reset_client()


def parse_json_response(raw: str) -> Any:
    """Strip markdown code fences and parse JSON."""
    stripped = re.sub(r"^```(?:json)?\s*\n?", "", raw, count=1)
    stripped = re.sub(r"\n?```\s*$", "", stripped, count=1)
    return json.loads(stripped)


def get_vision_extraction(
    image_base64: str, mime_type: str, instructions: str = ""
) -> dict[str, Any]:
    """Extract vocab pairs from an image using Gemini vision API.

    Returns {"pairs": [...], "usage": {...}}.
    """
    template = _prompt_templates["photoExtract"]
    system_prompt = template["system"]
    user_message = template.get("user_template", "Extract vocabulary from this image.")
    if instructions:
        user_message += (
            "\n\nIMPORTANT — follow these additional instructions"
            f" strictly:\n{instructions}"
        )
        log.info("Photo extract with user instructions: %s", instructions)
    else:
        log.info("Photo extract with no user instructions")

    result = providers.gemini.get_vision_json_completion(
        system_prompt, user_message, image_base64, mime_type
    )
    raw = result.get("text", "")
    parsed = parse_json_response(raw)

    # Normalize: ensure we have a list of {word, definition} dicts
    if isinstance(parsed, dict) and "pairs" in parsed:
        pairs = parsed["pairs"]
    elif isinstance(parsed, list):
        pairs = parsed
    else:
        pairs = [parsed]

    validated: list[dict[str, str]] = []
    for item in pairs:
        if isinstance(item, dict) and item.get("word"):
            definition = str(item.get("definition", "")).strip()
            # Strip English articles from definitions
            lower_def = definition.lower()
            for article in ("the ", "a ", "an "):
                if lower_def.startswith(article):
                    definition = definition[len(article):]
                    break
            validated.append({
                "word": str(item["word"]).strip(),
                "definition": definition,
            })

    return {"pairs": validated, "usage": result.get("usage")}


def get_cloze_transcription(
    image_base64: str, mime_type: str
) -> dict[str, Any]:
    """Transcribe a fill-in-the-blank exercise image to structured text.

    Uses Gemini vision. Returns {"transcription": str, "usage": {...}}.
    """
    template = _prompt_templates["photoClozeTranscribe"]
    system_prompt = template["system"]
    user_message = template.get(
        "user_template", "Transcribe this textbook exercise page."
    )
    result = providers.gemini.get_vision_text_completion(
        system_prompt, user_message, image_base64, mime_type
    )
    return {
        "transcription": result.get("text", "").strip(),
        "usage": result.get("usage"),
    }


def build_cloze_extract_prompt(
    transcription: str,
    language: dict[str, Any],
    transliteration: bool,
) -> tuple[str, str]:
    """Build the text prompt that turns a transcription into ClozeItem JSON.

    Returns (system_prompt, user_message).
    """
    template = _prompt_templates["photoClozeExtract"]
    system_prompt = _render_prompt(template["system"], transliteration, language)
    user_message = template["user_template"].replace(
        "{{transcription}}", transcription
    )
    return system_prompt, user_message


def build_photo_generate_prompt(
    pairs: list[dict[str, str]],
    language: dict[str, Any],
    transliteration: bool,
) -> tuple[str, str]:
    """Build a prompt to generate flashcards for a batch of word+definition pairs.

    Returns (system_prompt, user_message).
    """
    template = _prompt_templates["photoGenerate"]
    system_prompt = _render_prompt(template["system"], transliteration, language)

    word_lines = []
    for p in pairs:
        word_lines.append(f"- {p['word']}: {p.get('definition', '')}")
    word_list = "\n".join(word_lines)

    user_message = template["user_template"].replace("{{wordList}}", word_list)
    return system_prompt, user_message


def build_pdf_scout_prompt(
    sections: list[dict[str, Any]],
    language: dict[str, Any],
) -> tuple[str, str]:
    """Build the PDF scout prompt — classifies a list of structural sections.

    Input: list of PdfSection-shaped dicts (id, heading, pageStart, pageEnd,
    bodySnippet, fontProfile). Output expected from AI: one ScoutedSection per
    section with contentType, suggestedTags, worthExtracting, confidence,
    relatedTo.
    """
    template = _prompt_templates["pdfScout"]
    system_prompt = _render_prompt(template["system"], False, language)
    outline_json = json.dumps(sections, ensure_ascii=False, indent=2)
    user_message = template["user_template"].replace("{{outline}}", outline_json)
    return system_prompt, user_message


def build_pdf_vocab_extract_prompt(
    section_text: str,
    language: dict[str, Any],
) -> tuple[str, str]:
    """Build the PDF vocab-extract prompt — text block of pairs → VocabPair[]."""
    template = _prompt_templates["pdfVocabExtract"]
    system_prompt = _render_prompt(template["system"], False, language)
    user_message = template["user_template"].replace("{{sectionText}}", section_text)
    return system_prompt, user_message


def build_pdf_passage_extract_prompt(
    passage_text: str,
    glossary_text: str,
    language: dict[str, Any],
    transliteration: bool,
) -> tuple[str, str]:
    """Build the PDF passage-extract prompt — passage + optional glossary → cards."""
    template = _prompt_templates["pdfPassageExtract"]
    system_prompt = _render_prompt(template["system"], transliteration, language)
    user_message = (
        template["user_template"]
        .replace("{{passageText}}", passage_text)
        .replace("{{glossaryText}}", glossary_text or "(no glossary provided)")
    )
    return system_prompt, user_message
