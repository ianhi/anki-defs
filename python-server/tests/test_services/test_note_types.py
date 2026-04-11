"""Tests for note_types.py — rendering + field building from shared data."""

from __future__ import annotations

from anki_defs.services import note_types
from anki_defs.services.note_types import (
    build_card_fields,
    locale_for_anki,
    render_note_type,
)


class TestRenderNoteType:
    def test_vocab_model_name_and_locale_substitution(self):
        lang = {"code": "bn-IN", "ttsLocale": "bn-IN"}
        rendered = render_note_type("vocab", lang, "anki-defs")
        assert rendered["modelName"] == "anki-defs-bn-IN"
        assert rendered["isCloze"] is False
        assert rendered["fields"][0] == "Word"
        assert "EnableRecognition" in rendered["fields"]
        # Locale substituted into TTS tag (underscore form)
        back = rendered["templates"][0]["Back"]
        assert "tts bn_IN:Word" in back
        # Template key rename to AnkiConnect shape
        assert "Name" in rendered["templates"][0]
        assert "Front" in rendered["templates"][0]
        assert "Back" in rendered["templates"][0]

    def test_cloze_uses_suffix(self):
        lang = {"code": "es-MX", "ttsLocale": "es-MX"}
        rendered = render_note_type("cloze", lang, "anki-defs")
        assert rendered["modelName"] == "anki-defs-es-MX-cloze"
        assert rendered["isCloze"] is True
        back = rendered["templates"][0]["Back"]
        assert "tts es_MX:FullSentence" in back

    def test_mc_cloze_suffix(self):
        lang = {"code": "es-MX", "ttsLocale": "es-MX"}
        rendered = render_note_type("mcCloze", lang, "anki-defs")
        assert rendered["modelName"] == "anki-defs-es-MX-mc-cloze"
        assert rendered["isCloze"] is True

    def test_falls_back_to_code_when_no_ttslocale(self):
        lang = {"code": "hi"}
        rendered = render_note_type("vocab", lang, "anki-defs")
        back = rendered["templates"][0]["Back"]
        assert "tts hi:Word" in back


class TestLocaleForAnki:
    def test_underscore_substitution(self):
        assert locale_for_anki("bn-IN") == "bn_IN"
        assert locale_for_anki("es-MX") == "es_MX"
        assert locale_for_anki("hi") == "hi"


class TestBuildCardFields:
    def test_vocab_defaults_to_recognition_and_listening(self):
        fields = build_card_fields(
            "vocab",
            word="বাজার",
            definition="market",
            native_definition="বাজার হলো একটা জায়গা",
            example="আমি বাজারে যাচ্ছি",
            translation="I am going to the market",
        )
        assert fields["Word"] == "বাজার"
        assert fields["Definition"] == "market"
        assert fields["NativeDefinition"] == "বাজার হলো একটা জায়গা"
        assert fields["Example"] == "আমি বাজারে যাচ্ছি"
        assert fields["Translation"] == "I am going to the market"
        assert fields["Image"] == ""
        # Default templates (when no override passed)
        assert fields["EnableRecognition"] == "1"
        assert fields["EnableProduction"] == ""
        assert fields["EnableListening"] == "1"

    def test_vocab_template_override(self):
        fields = build_card_fields(
            "vocab",
            word="x",
            definition="",
            native_definition="",
            example="",
            translation="",
            vocab_templates={"recognition": False, "production": True, "listening": False},
        )
        assert fields["EnableRecognition"] == ""
        assert fields["EnableProduction"] == "1"
        assert fields["EnableListening"] == ""

    def test_cloze_fields(self):
        fields = build_card_fields(
            "cloze",
            word="বাজার",
            definition="market",
            native_definition="",
            example="আমি {{c1::বাজার}}ে যাচ্ছি",
            translation="I am going to the market",
        )
        assert fields["Text"] == "আমি {{c1::বাজার}}ে যাচ্ছি"
        assert fields["FullSentence"] == "আমি {{c1::বাজার}}ে যাচ্ছি"
        assert fields["English"] == "I am going to the market"

    def test_mc_cloze_fields_have_all_expected_keys(self):
        fields = build_card_fields(
            "mcCloze",
            word="answer",
            definition="def",
            native_definition="explanation",
            example="an {{c1::answer}} here",
            translation="",
        )
        assert fields["Answer"] == "answer"
        assert fields["AnswerDef"] == "def"
        assert fields["Explanation"] == "explanation"
        # Distractors are reserved for future fill-in
        assert fields["Distractor1"] == ""


class TestLoadFromDisk:
    def test_note_types_json_has_all_three(self):
        # Reset cache to force a fresh load from disk
        note_types.reset_cache()
        assert note_types.get_note_type_definition("vocab")["fields"][0] == "Word"
        assert note_types.get_note_type_definition("cloze")["isCloze"] is True
        assert note_types.get_note_type_definition("mcCloze")["isCloze"] is True
