"""Tests for card extraction service."""

from __future__ import annotations

import pytest

from anki_defs.services.card_extraction import (
    apply_spelling_correction,
    build_card_previews,
    validate_card_responses,
)


class TestValidateCardResponses:
    def test_single_object(self):
        cards = validate_card_responses({"word": "বাজার", "definition": "market"})
        assert len(cards) == 1
        assert cards[0]["word"] == "বাজার"

    def test_array(self):
        cards = validate_card_responses([
            {"word": "বাজার", "definition": "market"},
            {"word": "মাছ", "definition": "fish"},
        ])
        assert len(cards) == 2

    def test_missing_word_raises(self):
        with pytest.raises(ValueError, match="missing"):
            validate_card_responses({"definition": "market"})

    def test_empty_word_raises(self):
        with pytest.raises(ValueError, match="missing"):
            validate_card_responses({"word": "  ", "definition": "market"})

    def test_non_object_raises(self):
        with pytest.raises(ValueError, match="expected object"):
            validate_card_responses("not an object")

    def test_missing_fields_default_to_empty(self):
        cards = validate_card_responses({"word": "test"})
        assert cards[0]["definition"] == ""
        assert cards[0]["banglaDefinition"] == ""
        assert cards[0]["exampleSentence"] == ""

    def test_spelling_correction_preserved(self):
        cards = validate_card_responses({
            "word": "কাঁদা",
            "spellingCorrection": "কাদা → কাঁদা",
        })
        assert cards[0]["spellingCorrection"] == "কাদা → কাঁদা"


class TestApplySpellingCorrection:
    def test_basic_correction(self):
        result = apply_spelling_correction("সে কাদছে।", "কাদছে → কাঁদছে")
        assert result == "সে কাঁদছে।"

    def test_bold_correction(self):
        result = apply_spelling_correction("সে **কাদছে**।", "কাদছে → কাঁদছে")
        assert result == "সে **কাঁদছে**।"

    def test_no_arrow_returns_unchanged(self):
        result = apply_spelling_correction("hello", "no arrow here")
        assert result == "hello"


class TestBuildCardPreviews:
    def test_new_word(self):
        cards = [{"word": "বাজার", "definition": "market", "banglaDefinition": "",
                  "exampleSentence": "test", "sentenceTranslation": "test"}]
        previews = build_card_previews(cards, "Bangla", {}, {})
        assert len(previews) == 1
        assert previews[0]["alreadyExists"] is False

    def test_existing_word(self):
        cards = [{"word": "বাজার", "definition": "market", "banglaDefinition": "",
                  "exampleSentence": "test", "sentenceTranslation": "test"}]
        anki_results = {"বাজার": {"noteId": 42, "fields": {}, "tags": [], "modelName": ""}}
        previews = build_card_previews(cards, "Bangla", anki_results, {})
        assert previews[0]["alreadyExists"] is True

    def test_spelling_correction_applied(self):
        cards = [{
            "word": "কাঁদা",
            "definition": "to cry",
            "banglaDefinition": "",
            "exampleSentence": "সে **কাদছে**।",
            "sentenceTranslation": "She is crying.",
            "spellingCorrection": "কাদছে → কাঁদছে",
        }]
        previews = build_card_previews(cards, "Bangla", {}, {})
        assert "কাঁদছে" in previews[0]["exampleSentence"]
