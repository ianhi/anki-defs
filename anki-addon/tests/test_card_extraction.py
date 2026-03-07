"""Tests for card extraction regex helpers (no Anki dependency)."""

from services.card_extraction import (
    extract_inflected_forms,
    extract_sentence_translation,
    extract_vocabulary_list,
)


class TestExtractVocabularyList:
    def test_basic_extraction(self):
        response = "Some text\n**Vocabulary:** one, two, three\nMore text"
        words = extract_vocabulary_list(response)
        assert words == ["one", "two", "three"]

    def test_empty_when_no_vocabulary_line(self):
        response = "Just some text without vocabulary"
        assert extract_vocabulary_list(response) == []

    def test_filters_asterisks(self):
        response = "**Vocabulary:** one, **two**, three"
        words = extract_vocabulary_list(response)
        # Words containing * are filtered out
        assert "one" in words
        assert "three" in words

    def test_trims_whitespace(self):
        response = "**Vocabulary:**   one ,  two ,  three  "
        words = extract_vocabulary_list(response)
        assert words == ["one", "two", "three"]


class TestExtractSentenceTranslation:
    def test_basic_translation(self):
        response = "**Translation:** This is the translation\nMore text"
        assert extract_sentence_translation(response) == "This is the translation"

    def test_sentence_translation(self):
        response = "**Sentence Translation:** This is the translation\nMore text"
        assert extract_sentence_translation(response) == "This is the translation"

    def test_empty_when_not_found(self):
        response = "No translation line here"
        assert extract_sentence_translation(response) == ""


class TestExtractInflectedForms:
    def test_basic_extraction(self):
        response = (
            "- **inflected1** something From **lemma1**\n"
            "- **inflected2** something From **lemma2**\n"
        )
        result = extract_inflected_forms(response)
        assert result["lemma1"] == "inflected1"
        assert result["lemma2"] == "inflected2"

    def test_same_form_skipped(self):
        response = "- **same** something From **same**\n"
        result = extract_inflected_forms(response)
        assert len(result) == 0

    def test_empty_when_no_pattern(self):
        result = extract_inflected_forms("No word-by-word section here")
        assert len(result) == 0
