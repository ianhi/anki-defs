"""Card extraction from AI responses — validation, Anki checking, preview building.

Ports Express cardExtraction.ts + addon card_extraction.py into shared service.
"""

from __future__ import annotations

import re
from typing import Any


def validate_card_responses(parsed: Any) -> list[dict[str, Any]]:
    """Validate and coerce a parsed AI response into card dicts. Raises if unrecoverable."""
    items = parsed if isinstance(parsed, list) else [parsed]
    cards = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"Card {i}: expected object, got {type(item).__name__}")
        word = str(item.get("word", "")).strip()
        if not word:
            raise ValueError(f'Card {i}: missing "word" field')
        card: dict[str, Any] = {
            "word": word,
            "definition": str(item.get("definition", "")),
            "nativeDefinition": str(item.get("nativeDefinition", "")),
            "exampleSentence": str(item.get("exampleSentence", "")),
            "sentenceTranslation": str(item.get("sentenceTranslation", "")),
        }
        spelling = item.get("spellingCorrection")
        if spelling:
            card["spellingCorrection"] = str(spelling)
        cards.append(card)
    return cards


def apply_spelling_correction(sentence: str, correction: str) -> str:
    """Parse 'input → standard' and apply to sentence, preserving **bold** markers."""
    match = re.match(r"^(.+?)\s*→\s*(.+)$", correction)
    if not match:
        return sentence
    wrong = match.group(1)
    right = match.group(2)
    result = sentence.replace(wrong, right).replace(f"**{wrong}**", f"**{right}**")
    return result


def _note_to_card_content(
    note: dict[str, Any], field_mapping: dict[str, str]
) -> dict[str, str]:
    """Reverse-map an Anki note's fields to card content using the field mapping."""

    def get_field(standard_name: str) -> str:
        mapped_name = field_mapping.get(standard_name, standard_name)
        field_data = note.get("fields", {}).get(mapped_name)
        if field_data:
            return field_data.get("value", "")
        return ""

    return {
        "word": get_field("Word"),
        "definition": get_field("Definition"),
        "nativeDefinition": get_field("NativeDefinition"),
        "exampleSentence": get_field("Example"),
        "sentenceTranslation": get_field("Translation"),
    }


def build_card_previews(
    cards: list[dict[str, Any]],
    target_deck: str,
    anki_results: dict[str, Any | None],
    field_mapping: dict[str, str],
) -> list[dict[str, Any]]:
    """Build card preview dicts from parsed AI JSON cards + Anki duplicate checks."""
    previews = []
    for card in cards:
        word = card.get("word", "")
        existing_note = anki_results.get(word)

        existing_card = None
        if existing_note and existing_note.get("noteId", 0) != 0:
            existing_card = _note_to_card_content(existing_note, field_mapping)

        example_sentence = card.get("exampleSentence", "")
        spelling_correction = card.get("spellingCorrection")
        if spelling_correction and example_sentence:
            example_sentence = apply_spelling_correction(example_sentence, spelling_correction)

        preview: dict[str, Any] = {
            "word": word,
            "definition": card.get("definition", ""),
            "nativeDefinition": card.get("nativeDefinition", ""),
            "exampleSentence": example_sentence,
            "sentenceTranslation": card.get("sentenceTranslation", ""),
            "alreadyExists": existing_note is not None,
        }
        if spelling_correction:
            preview["spellingCorrection"] = spelling_correction
        if existing_card:
            preview["existingCard"] = existing_card

        previews.append(preview)

    return previews
