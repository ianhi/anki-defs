"""Note type definitions and per-language model rendering.

Loads `shared/data/note-types.json` (the source of truth for which fields,
CSS, and card templates each card type uses) and exposes helpers to:

- Build the concrete model definition (model name, fields, css, templates)
  for a given language by substituting `{{LOCALE}}` in template strings.
- Convert a domain card payload into the field map for a specific card type.

The client never sends raw field maps -- it sends a `CreateNoteRequest`-style
payload and the server routes that through `render_note_type` +
`build_card_fields` to decide what ends up in Anki.
"""

from __future__ import annotations

import json
import re
from typing import Any, Literal

from ..config import DATA_DIR

CardType = Literal["vocab", "cloze", "mcCloze"]

_CARD_TYPES: tuple[CardType, ...] = ("vocab", "cloze", "mcCloze")

_note_types_cache: dict[str, Any] | None = None


def _load_note_types() -> dict[str, Any]:
    """Load note-types.json once and cache the parsed result."""
    global _note_types_cache
    if _note_types_cache is None:
        with open(DATA_DIR / "note-types.json", encoding="utf-8") as f:
            _note_types_cache = json.load(f)
    assert _note_types_cache is not None
    return _note_types_cache


def get_note_type_definition(card_type: CardType) -> dict[str, Any]:
    """Return the raw note-type definition from shared/data/note-types.json."""
    data = _load_note_types()
    if card_type not in data:
        raise ValueError(f"Unknown card type: {card_type}")
    return data[card_type]


def all_card_types() -> tuple[CardType, ...]:
    return _CARD_TYPES


def locale_for_anki(ttslocale: str) -> str:
    """Convert a BCP-47 locale (bn-IN) to Anki's underscore form (bn_IN)."""
    return ttslocale.replace("-", "_")


def _substitute_locale(text: str, anki_locale: str) -> str:
    return text.replace("{{LOCALE}}", anki_locale)


def render_note_type(
    card_type: CardType,
    language: dict[str, Any],
    note_type_prefix: str,
    anki_tts_locale_override: str | None = None,
) -> dict[str, Any]:
    """Return a concrete, ready-to-create Anki model definition for a language.

    The returned dict has keys: ``modelName``, ``fields``, ``css``, ``isCloze``,
    ``templates`` (list of ``{"Name", "Front", "Back"}``).

    ``anki_tts_locale_override`` lets the user pin a different locale for the
    Anki TTS template tag, e.g. an ``es-MX`` deck whose voices are installed
    under ``es_US``. Accepts either ``es_US`` or ``es-US`` form.
    """
    definition = get_note_type_definition(card_type)
    code = language["code"]
    tts_locale = anki_tts_locale_override or language.get("ttsLocale") or code
    anki_locale = locale_for_anki(tts_locale)

    suffix = definition.get("modelNameSuffix", "")
    model_name = f"{note_type_prefix}-{code}{suffix}"

    version = definition.get("version", 0)
    tag = (
        f"<!-- card-template:v{version}"
        " \u2014 do not delete, used for auto-updating -->\n"
    )

    templates: list[dict[str, str]] = []
    for tmpl in definition["templates"]:
        templates.append(
            {
                "Name": tmpl["name"],
                "Front": tag + _substitute_locale(tmpl["front"], anki_locale),
                "Back": tag + _substitute_locale(tmpl["back"], anki_locale),
            }
        )

    return {
        "modelName": model_name,
        "version": version,
        "fields": list(definition["fields"]),
        "css": definition["css"],
        "isCloze": bool(definition.get("isCloze", False)),
        "templates": templates,
    }


_VERSION_RE = re.compile(r"<!--\s*card-template:v(\d+)\b")


def extract_template_version(template_text: str) -> int | None:
    """Extract the version number from a card-template version comment.

    Returns ``None`` if no version tag is found (pre-versioning template).
    """
    m = _VERSION_RE.search(template_text)
    return int(m.group(1)) if m else None


_BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")


def _md_to_html(text: str) -> str:
    """Convert markdown bold (**foo**) to <b> tags. Anki renders fields as HTML."""
    return _BOLD_RE.sub(r"<b>\1</b>", text)


def _flag(value: bool) -> str:
    """Anki uses non-empty strings as "true" for conditional fields."""
    return "1" if value else ""


def build_card_fields(
    card_type: CardType,
    *,
    word: str,
    definition: str,
    native_definition: str,
    example: str,
    translation: str,
    vocab_templates: dict[str, bool] | None = None,
) -> dict[str, str]:
    """Build the field map for an Anki note from a domain card payload.

    For vocab cards, ``vocab_templates`` toggles the EnableRecognition /
    EnableProduction / EnableListening gate fields. Callers should fall back
    to the global ``vocabCardTemplates`` setting before calling if nothing
    was overridden per-note.
    """
    example_html = _md_to_html(example)
    translation_html = _md_to_html(translation)

    if card_type == "vocab":
        tmpls = vocab_templates or {}
        return {
            "Word": word,
            "Definition": definition,
            "NativeDefinition": native_definition,
            "Example": example_html,
            "Translation": translation_html,
            "Image": "",
            "WordAudio": "",
            "ExampleAudio": "",
            "EnableRecognition": _flag(bool(tmpls.get("recognition", True))),
            "EnableProduction": _flag(bool(tmpls.get("production", False))),
            "EnableListening": _flag(bool(tmpls.get("listening", True))),
        }

    if card_type == "cloze":
        # Text is the cloze sentence (caller is expected to have inserted
        # {{c1::...}} markers around the target word if applicable).
        return {
            "Text": example_html or word,
            "English": translation_html,
            "FullSentence": example_html,
            "ShowEnglish": "",
            "Tense": "",
            "Image": "",
            "FullSentenceAudio": "",
        }

    if card_type == "mcCloze":
        return {
            "Text": example_html or word,
            "FullSentence": example_html,
            "Answer": word,
            "AnswerDef": definition,
            "Distractor1": "",
            "Distractor1Def": "",
            "Distractor2": "",
            "Distractor2Def": "",
            "Distractor3": "",
            "Distractor3Def": "",
            "Explanation": native_definition,
            "SentenceAnalysis": "",
            "Level": "",
            "Focus": "",
            "TatoebaID": "",
            "FullSentenceAudio": "",
            "AnswerAudio": "",
            "Distractor1Audio": "",
            "Distractor2Audio": "",
            "Distractor3Audio": "",
        }

    raise ValueError(f"Unknown card type: {card_type}")


def reset_cache() -> None:
    """Drop the cached note-types.json (used by tests)."""
    global _note_types_cache
    _note_types_cache = None
