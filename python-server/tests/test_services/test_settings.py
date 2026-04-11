"""Tests for settings service."""

from __future__ import annotations

from anki_defs.services.settings import get_settings, mask_key, save_settings


def test_defaults_loaded():
    settings = get_settings()
    assert settings["aiProvider"] == "gemini"
    assert settings["defaultDeck"] == "Bangla"
    assert settings["noteTypePrefix"] == "anki-defs"
    assert settings["targetLanguage"] == "bn-IN"
    assert "defaultModel" not in settings
    assert "fieldMapping" not in settings


def test_save_and_load(tmp_path, monkeypatch):
    from anki_defs import config

    settings_file = config.SETTINGS_FILE
    save_settings({"aiProvider": "gemini"})
    assert settings_file.exists()

    settings = get_settings()
    assert settings["aiProvider"] == "gemini"
    # Defaults still present
    assert settings["defaultDeck"] == "Bangla"


def test_env_overrides(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-1234")
    monkeypatch.setenv("AI_PROVIDER", "gemini")
    settings = get_settings()
    assert settings["geminiApiKey"] == "test-key-1234"
    assert settings["aiProvider"] == "gemini"


def test_env_overrides_file_settings(monkeypatch):
    save_settings({"geminiApiKey": "file-key"})
    monkeypatch.setenv("GEMINI_API_KEY", "env-key")
    settings = get_settings()
    assert settings["geminiApiKey"] == "env-key"


def test_mask_key():
    assert mask_key("") == ""
    assert mask_key("sk-1234567890abcdef") == "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022cdef"
    assert mask_key("ab") == "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022ab"


class TestMigration:
    def test_strips_dead_fields(self):
        from anki_defs.services.settings_base import _migrate_settings

        result = _migrate_settings(
            {
                "defaultModel": "Bangla (and reversed)",
                "fieldMapping": {"Word": "Front"},
                "clozeNoteType": "Cloze",
                "clozeFieldMapping": {"Text": "Text"},
                "mcClozeNoteType": "MC",
                "mcClozeFieldMapping": {},
                "aiProvider": "gemini",
            }
        )
        assert "defaultModel" not in result
        assert "fieldMapping" not in result
        assert "clozeNoteType" not in result
        assert "clozeFieldMapping" not in result
        assert "mcClozeNoteType" not in result
        assert "mcClozeFieldMapping" not in result
        assert result["aiProvider"] == "gemini"

    def test_renames_bn_to_bn_in(self):
        from anki_defs.services.settings_base import _migrate_settings

        result = _migrate_settings({"targetLanguage": "bn"})
        assert result["targetLanguage"] == "bn-IN"

    def test_preserves_non_bn_target_language(self):
        from anki_defs.services.settings_base import _migrate_settings

        result = _migrate_settings({"targetLanguage": "es-MX"})
        assert result["targetLanguage"] == "es-MX"

    def test_adds_note_type_prefix_if_missing(self):
        from anki_defs.services.settings_base import _migrate_settings

        result = _migrate_settings({})
        assert result["noteTypePrefix"] == "anki-defs"

    def test_adds_vocab_card_templates_if_missing(self):
        from anki_defs.services.settings_base import _migrate_settings

        result = _migrate_settings({})
        assert result["vocabCardTemplates"] == {
            "recognition": True,
            "production": False,
            "listening": True,
        }

    def test_preserves_existing_note_type_prefix(self):
        from anki_defs.services.settings_base import _migrate_settings

        result = _migrate_settings({"noteTypePrefix": "custom"})
        assert result["noteTypePrefix"] == "custom"


def test_file_permissions():
    import os
    import stat

    from anki_defs import config

    save_settings({"aiProvider": "claude"})
    mode = os.stat(config.SETTINGS_FILE).st_mode
    assert mode & stat.S_IRWXG == 0  # No group access
    assert mode & stat.S_IRWXO == 0  # No other access
