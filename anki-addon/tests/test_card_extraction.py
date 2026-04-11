"""Tests for card extraction / card preview building (no Anki dependency)."""

import json

import pytest
from anki_defs._services.card_extraction import _note_to_card_content
from anki_defs.services.ai_service import parse_json_response
from anki_defs.services.card_extraction import apply_spelling_correction


class TestApplySpellingCorrection:
    def test_basic_correction(self):
        sentence = "মেয়েটা **কাদছে**।"
        correction = "কাদছে → কাঁদছে"
        result = apply_spelling_correction(sentence, correction)
        assert result == "মেয়েটা **কাঁদছে**।"

    def test_no_arrow_returns_original(self):
        sentence = "some sentence"
        result = apply_spelling_correction(sentence, "no arrow here")
        assert result == sentence

    def test_bare_and_bold_replacement(self):
        sentence = "word **word** more word"
        correction = "word → fixed"
        result = apply_spelling_correction(sentence, correction)
        assert "**fixed**" in result
        # bare occurrences also replaced
        assert "word" not in result.replace("**fixed**", "")

    def test_empty_correction(self):
        sentence = "hello"
        result = apply_spelling_correction(sentence, "")
        assert result == sentence


class TestNoteToExistingCard:
    def test_basic_mapping(self):
        """Canonical field names from an auto-created note type."""
        note = {
            "fields": {
                "Word": {"value": "কাঁদা", "order": 0},
                "Definition": {"value": "to cry", "order": 1},
                "NativeDefinition": {"value": "চোখ থেকে জল পড়া", "order": 2},
                "Example": {"value": "মেয়েটা কাঁদছে।", "order": 3},
                "Translation": {"value": "The girl is crying.", "order": 4},
            }
        }
        result = _note_to_card_content(note)
        assert result["word"] == "কাঁদা"
        assert result["definition"] == "to cry"
        assert result["nativeDefinition"] == "চোখ থেকে জল পড়া"
        assert result["exampleSentence"] == "মেয়েটা কাঁদছে।"
        assert result["sentenceTranslation"] == "The girl is crying."

    def test_front_fallback(self):
        """Legacy notes that use "Front" for the headword still resolve."""
        note = {"fields": {"Front": {"value": "legacy", "order": 0}}}
        result = _note_to_card_content(note)
        assert result["word"] == "legacy"

    def test_empty_fields(self):
        result = _note_to_card_content({"fields": {}})
        assert result["word"] == ""
        assert result["definition"] == ""


class TestParseJsonResponse:
    def test_plain_json_object(self):
        raw = '{"word": "test", "definition": "a test"}'
        result = parse_json_response(raw)
        assert result["word"] == "test"

    def test_json_array(self):
        raw = '[{"word": "a"}, {"word": "b"}]'
        result = parse_json_response(raw)
        assert len(result) == 2

    def test_strip_code_fences(self):
        raw = '```json\n{"word": "test"}\n```'
        result = parse_json_response(raw)
        assert result["word"] == "test"

    def test_strip_code_fences_no_json_label(self):
        raw = '```\n{"word": "test"}\n```'
        result = parse_json_response(raw)
        assert result["word"] == "test"

    def test_invalid_json_raises(self):
        with pytest.raises((json.JSONDecodeError, ValueError)):
            parse_json_response("not json at all")

    def test_whitespace_around_fences(self):
        raw = '```json\n  {"word": "test"}  \n```  '
        result = parse_json_response(raw)
        assert result["word"] == "test"
