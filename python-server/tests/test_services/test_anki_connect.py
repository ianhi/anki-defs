"""Tests for anki_connect: ensure_language_models + create_card orchestration.

The AnkiConnect HTTP calls are mocked at the ``_invoke`` layer so these tests
never hit a real Anki instance.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from anki_defs.services import anki_connect


@pytest.fixture(autouse=True)
def _reset_caches():
    anki_connect.reset_ensured_models_cache()
    yield
    anki_connect.reset_ensured_models_cache()


class FakeAnki:
    """Tracks AnkiConnect calls for assertions."""

    def __init__(self, existing_models: list[str] | None = None) -> None:
        self.existing_models: list[str] = list(existing_models or [])
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.next_note_id = 1001

    def invoke(self, action: str, **params: Any) -> Any:
        self.calls.append((action, params))
        if action == "modelNames":
            return list(self.existing_models)
        if action == "createModel":
            self.existing_models.append(params["modelName"])
            return None
        if action == "addNote":
            note_id = self.next_note_id
            self.next_note_id += 1
            return note_id
        if action == "findNotes":
            return []
        return None


@pytest.fixture
def fake_anki():
    return FakeAnki()


@pytest.fixture
def patched(fake_anki):
    with patch.object(anki_connect, "_invoke", side_effect=fake_anki.invoke):
        yield fake_anki


BN_LANG = {
    "code": "bn-IN",
    "name": "Bangla (India)",
    "ttsLocale": "bn-IN",
}


class TestEnsureLanguageModels:
    def test_creates_missing_models(self, patched):
        result = anki_connect.ensure_language_models(BN_LANG, "anki-defs", ["vocab"])
        assert result["vocab"] == "anki-defs-bn-IN"
        create_calls = [c for c in patched.calls if c[0] == "createModel"]
        assert len(create_calls) == 1
        created = create_calls[0][1]
        assert created["modelName"] == "anki-defs-bn-IN"
        assert "Word" in created["inOrderFields"]
        assert created["isCloze"] is False
        # Templates use AnkiConnect shape
        assert set(created["cardTemplates"][0].keys()) == {"Name", "Front", "Back"}
        # Locale substituted
        assert "tts bn_IN:Word" in created["cardTemplates"][0]["Back"]

    def test_idempotent_when_model_already_exists(self, patched):
        patched.existing_models = ["anki-defs-bn-IN"]
        anki_connect.ensure_language_models(BN_LANG, "anki-defs", ["vocab"])
        create_calls = [c for c in patched.calls if c[0] == "createModel"]
        assert create_calls == []

    def test_caches_across_calls(self, patched):
        anki_connect.ensure_language_models(BN_LANG, "anki-defs", ["vocab"])
        first_call_count = len(patched.calls)
        # Second call: cache hit → no additional AnkiConnect calls at all.
        anki_connect.ensure_language_models(BN_LANG, "anki-defs", ["vocab"])
        assert len(patched.calls) == first_call_count

    def test_all_three_defaults(self, patched):
        result = anki_connect.ensure_language_models(BN_LANG, "anki-defs")
        assert set(result.keys()) == {"vocab", "cloze", "mcCloze"}
        created_names = [
            c[1]["modelName"] for c in patched.calls if c[0] == "createModel"
        ]
        assert "anki-defs-bn-IN" in created_names
        assert "anki-defs-bn-IN-cloze" in created_names
        assert "anki-defs-bn-IN-mc-cloze" in created_names


class TestCreateCardVocab:
    def test_builds_fields_and_calls_addnote(self, patched, monkeypatch):
        # Stub the language resolver so we don't depend on settings state.
        monkeypatch.setattr(
            anki_connect.ai, "get_language_for_deck", lambda deck: BN_LANG
        )
        # Stub settings for noteTypePrefix + vocabCardTemplates defaults.
        monkeypatch.setattr(
            anki_connect,
            "get_settings",
            lambda: {
                "noteTypePrefix": "anki-defs",
                "vocabCardTemplates": {
                    "recognition": True,
                    "production": False,
                    "listening": True,
                },
            },
        )
        note_id, model_name = anki_connect.create_card(
            deck="Bangla",
            card_type="vocab",
            word="বাজার",
            definition="market",
            native_definition="বাজার হলো",
            example="আমি বাজারে যাচ্ছি",
            translation="I am going",
        )
        assert note_id == 1001
        assert model_name == "anki-defs-bn-IN"
        add_calls = [c for c in patched.calls if c[0] == "addNote"]
        assert len(add_calls) == 1
        note = add_calls[0][1]["note"]
        assert note["deckName"] == "Bangla"
        assert note["modelName"] == "anki-defs-bn-IN"
        fields = note["fields"]
        assert fields["Word"] == "বাজার"
        assert fields["EnableRecognition"] == "1"
        assert fields["EnableProduction"] == ""
        assert fields["EnableListening"] == "1"
        # Ensures model was created on the way.
        create_calls = [c for c in patched.calls if c[0] == "createModel"]
        assert len(create_calls) == 1

    def test_per_note_template_override_wins(self, patched, monkeypatch):
        monkeypatch.setattr(
            anki_connect.ai, "get_language_for_deck", lambda deck: BN_LANG
        )
        monkeypatch.setattr(
            anki_connect,
            "get_settings",
            lambda: {
                "noteTypePrefix": "anki-defs",
                "vocabCardTemplates": {
                    "recognition": True,
                    "production": False,
                    "listening": True,
                },
            },
        )
        anki_connect.create_card(
            deck="Bangla",
            card_type="vocab",
            word="x",
            definition="",
            native_definition="",
            example="",
            translation="",
            vocab_templates={
                "recognition": False,
                "production": True,
                "listening": False,
            },
        )
        note = [c for c in patched.calls if c[0] == "addNote"][0][1]["note"]
        assert note["fields"]["EnableProduction"] == "1"
        assert note["fields"]["EnableRecognition"] == ""
        assert note["fields"]["EnableListening"] == ""


class TestCreateCardCloze:
    def test_cloze_builds_text_and_uses_cloze_model(self, patched, monkeypatch):
        monkeypatch.setattr(
            anki_connect.ai, "get_language_for_deck", lambda deck: BN_LANG
        )
        monkeypatch.setattr(
            anki_connect,
            "get_settings",
            lambda: {"noteTypePrefix": "anki-defs"},
        )
        anki_connect.create_card(
            deck="Bangla",
            card_type="cloze",
            word="বাজার",
            definition="market",
            native_definition="",
            example="আমি {{c1::বাজার}}ে যাচ্ছি",
            translation="I am going to the market",
        )
        note = [c for c in patched.calls if c[0] == "addNote"][0][1]["note"]
        assert note["modelName"] == "anki-defs-bn-IN-cloze"
        assert note["fields"]["Text"] == "আমি {{c1::বাজার}}ে যাচ্ছি"
        assert note["fields"]["English"] == "I am going to the market"


class TestCreateCardMcCloze:
    def test_mc_cloze_model_and_answer(self, patched, monkeypatch):
        monkeypatch.setattr(
            anki_connect.ai, "get_language_for_deck", lambda deck: BN_LANG
        )
        monkeypatch.setattr(
            anki_connect,
            "get_settings",
            lambda: {"noteTypePrefix": "anki-defs"},
        )
        anki_connect.create_card(
            deck="Bangla",
            card_type="mcCloze",
            word="বাজার",
            definition="market",
            native_definition="expl",
            example="আমি {{c1::বাজার}}ে",
            translation="",
        )
        note = [c for c in patched.calls if c[0] == "addNote"][0][1]["note"]
        assert note["modelName"] == "anki-defs-bn-IN-mc-cloze"
        assert note["fields"]["Answer"] == "বাজার"
        assert note["fields"]["Explanation"] == "expl"
