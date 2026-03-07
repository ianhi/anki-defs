"""Card data extraction from AI responses.

Mirrors server/src/services/cardExtraction.ts -- extracts vocabulary lists,
sentence translations, and inflected forms from AI text output, then uses
Gemini structured output to extract card data.
"""

import re
from . import gemini_provider
from .anki_service import search_word
from .settings_service import get_settings


def extract_vocabulary_list(response):
    """Extract vocabulary list from AI response (for sentence mode)."""
    match = re.search(r"\*\*Vocabulary:\*\*\s*([^\n]+)", response, re.IGNORECASE)
    if not match or not match.group(1):
        return []
    words = [w.strip() for w in match.group(1).split(",")]
    return [w for w in words if w and "*" not in w]


def extract_sentence_translation(response):
    """Extract sentence translation from AI response."""
    match = re.search(
        r"\*\*(?:Sentence )?Translation:\*\*\s*([^\n]+)", response, re.IGNORECASE
    )
    if match and match.group(1):
        return match.group(1).strip()
    return ""


def extract_inflected_forms(response):
    """Extract inflected-to-lemma mappings from the Word-by-word section.

    Returns a dict of lemma -> inflected form.
    """
    result = {}
    for match in re.finditer(
        r"- \*\*([^*]+)\*\*[^]*?From \*\*([^*]+)\*\*", response
    ):
        inflected = match.group(1).strip()
        lemma = match.group(2).strip()
        if inflected and lemma and inflected != lemma:
            result[lemma] = inflected
    return result


def extract_cards(
    words_for_cards,
    full_response,
    original_sentence,
    sentence_translation,
    is_sentence_mode,
    target_deck,
    anki_results,
    inflected_forms=None,
):
    """Extract card data for each word and check Anki for duplicates.

    anki_results: dict of {word: bool} (pre-populated).
    Returns (card_previews, errors).
    """
    settings = get_settings()
    field_mapping = settings.get("fieldMapping")
    errors = []

    if not words_for_cards:
        return [], errors

    # Check Anki for words not yet checked
    for word in words_for_cards:
        if word not in anki_results:
            _check_anki(word, target_deck, anki_results, field_mapping)

    # Extract card data for each word
    card_data_list = []
    for word in words_for_cards:
        try:
            if is_sentence_mode:
                card_data = gemini_provider.extract_card_data_from_sentence(
                    word, original_sentence, sentence_translation, full_response
                )
            else:
                card_data = gemini_provider.extract_card_data(word, full_response)
            card_data_list.append({"word": word, "cardData": card_data})
        except Exception as e:
            errors.append(str(e))

    # Check Anki for lemmatized forms (extraction may return a different lemma)
    for item in card_data_list:
        lemma = item["cardData"].get("word", "")
        if lemma and lemma != item["word"]:
            _check_anki(lemma, target_deck, anki_results, field_mapping)

    # Build card previews
    card_previews = []
    for item in card_data_list:
        word = item["word"]
        card_data = item["cardData"]
        lemma_differs = card_data.get("word", "") != word

        inflected = None
        if lemma_differs:
            inflected = word
        elif inflected_forms:
            inflected = inflected_forms.get(word) or inflected_forms.get(
                card_data.get("word", "")
            )

        preview = {
            "word": card_data.get("word", word),
            "definition": card_data.get("definition", ""),
            "exampleSentence": card_data.get("exampleSentence", ""),
            "sentenceTranslation": card_data.get("sentenceTranslation", ""),
            "alreadyExists": anki_results.get(card_data.get("word", ""), False)
            or anki_results.get(word, False),
        }
        if inflected:
            preview["inflectedForm"] = inflected
        if lemma_differs:
            preview["lemmaMismatch"] = True
            preview["originalLemma"] = word

        card_previews.append(preview)

    return card_previews, errors


def _check_anki(word, deck, results, field_mapping):
    """Check Anki for a word, silently handling errors."""
    if word in results:
        return
    try:
        note = search_word(word, deck, field_mapping)
        results[word] = note is not None
    except Exception:
        pass
