"""Card preview building from parsed JSON AI responses.

Takes parsed card dicts from the JSON-first pipeline, checks Anki for
duplicates, applies spelling corrections, and returns card preview dicts.
"""

import re

from .anki_service import search_word
from .settings_service import get_settings


def apply_spelling_correction(sentence, correction):
    """Parse a spellingCorrection like 'input -> standard' and apply to sentence.

    Replaces the misspelled form with the corrected form (preserving **bold** markers).
    """
    match = re.match(r"^(.+?)\s*→\s*(.+)$", correction)
    if not match:
        return sentence
    wrong = match.group(1)
    right = match.group(2)
    # Replace both bare and **bold** occurrences
    result = sentence.replace(wrong, right).replace(
        "**{}**".format(wrong), "**{}**".format(right)
    )
    return result


def _note_to_existing_card(note, field_mapping):
    """Reverse-map an Anki note's fields to card content using the field mapping.

    Returns a dict with word, definition, banglaDefinition, exampleSentence,
    sentenceTranslation keys.
    """
    if not note or not field_mapping:
        return None

    def get_field(standard_name):
        mapped_name = field_mapping.get(standard_name, standard_name)
        field_data = note.get("fields", {}).get(mapped_name)
        if field_data:
            return field_data.get("value", "")
        return ""

    return {
        "word": get_field("Word"),
        "definition": get_field("Definition"),
        "banglaDefinition": get_field("BanglaDefinition"),
        "exampleSentence": get_field("Example"),
        "sentenceTranslation": get_field("Translation"),
    }


def build_card_previews(cards, target_deck, anki_results):
    """Build card preview dicts from parsed AI JSON cards + Anki duplicate checks.

    cards: list of dicts with word, definition, banglaDefinition, exampleSentence,
           sentenceTranslation, and optional spellingCorrection.
    target_deck: deck name for Anki searches.
    anki_results: dict of {word: note_dict_or_None} (pre-populated).
    Returns list of card preview dicts.
    """
    settings = get_settings()
    field_mapping = settings.get("fieldMapping") or {}

    # Check Anki for any words not yet checked
    for card in cards:
        word = card.get("word", "")
        if word and word not in anki_results:
            _check_anki(word, target_deck, anki_results, field_mapping)

    previews = []
    for card in cards:
        word = card.get("word", "")
        existing_note = anki_results.get(word)

        existing_card = None
        if existing_note:
            existing_card = _note_to_existing_card(existing_note, field_mapping)

        # Apply spelling correction to the example sentence if present
        example_sentence = card.get("exampleSentence", "")
        spelling_correction = card.get("spellingCorrection")
        if spelling_correction and example_sentence:
            example_sentence = apply_spelling_correction(example_sentence, spelling_correction)

        preview = {
            "word": word,
            "definition": card.get("definition", ""),
            "banglaDefinition": card.get("banglaDefinition", ""),
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


def _check_anki(word, deck, results, field_mapping):
    """Check Anki for a word, storing the note dict or None. Silently handles errors."""
    if word in results:
        return
    try:
        note = search_word(word, deck, field_mapping)
        results[word] = note
    except Exception:
        results[word] = None
