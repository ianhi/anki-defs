"""Tests that shared data files (prompts, settings defaults) load correctly."""

import json
import os

SHARED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "shared")


class TestSharedPrompts:
    """Verify shared/prompts/*.json files exist and have expected structure."""

    def _load(self, filename):
        path = os.path.join(SHARED_DIR, "prompts", filename)
        assert os.path.isfile(path), "Missing shared prompt: {}".format(filename)
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def test_variables_json(self):
        data = self._load("variables.json")
        assert "preamble" in data
        assert "outputRules" in data
        assert "languageRules" in data
        assert "transliteration" in data
        assert "instruction" in data["transliteration"]
        assert "marker" in data["transliteration"]
        assert "true" in data["transliteration"]["instruction"]
        assert "false" in data["transliteration"]["instruction"]

    def test_single_word_prompt(self):
        data = self._load("single-word.json")
        assert "system" in data
        assert "user_template" in data
        assert "{{preamble}}" in data["system"]
        assert "{{transliterationInstruction}}" in data["system"]

    def test_focused_words_prompt(self):
        data = self._load("focused-words.json")
        assert "system" in data
        assert "user_template" in data
        assert "{{preamble}}" in data["system"]

    def test_relemmatize_prompt(self):
        data = self._load("relemmatize.json")
        assert "system" in data
        assert "{{word}}" in data["system"]
        assert "{{context}}" in data["system"]


class TestSharedSettingsDefaults:
    """Verify shared/defaults/settings.json exists and has expected fields."""

    def test_defaults_exist(self):
        path = os.path.join(SHARED_DIR, "defaults", "settings.json")
        assert os.path.isfile(path)
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Check key fields match the Settings type from shared/types.ts
        assert "aiProvider" in data
        assert "defaultDeck" in data
        assert "defaultModel" in data
        assert "fieldMapping" in data
        assert isinstance(data["fieldMapping"], dict)


class TestPromptRendering:
    """Test that ai_service can load and render prompts from shared files."""

    def test_render_prompts_no_transliteration(self):
        from services.ai_service import get_system_prompts

        prompts = get_system_prompts(False)
        assert "word" in prompts
        assert "focusedWords" in prompts
        # Variables should be substituted
        for key, value in prompts.items():
            assert "{{preamble}}" not in value, "Unsubstituted variable in {}".format(key)
            assert "{{outputRules}}" not in value
            assert "{{languageRules}}" not in value
            assert "{{transliterationInstruction}}" not in value
            assert "{{translitMarker}}" not in value
        # Without transliteration, should say "Do NOT"
        assert "Do NOT" in prompts["word"]

    def test_render_prompts_with_transliteration(self):
        from services.ai_service import get_system_prompts

        prompts = get_system_prompts(True)
        # With transliteration, should include instruction
        assert "Include romanized" in prompts["word"]

    def test_render_user_template_word(self):
        from services.ai_service import render_user_template

        result = render_user_template("word", {"word": "কাঁদা"})
        assert result is not None
        assert "কাঁদা" in result

    def test_render_user_template_word_with_context(self):
        from services.ai_service import render_user_template

        result = render_user_template("word", {"word": "কাঁদা", "userContext": "to cry"})
        assert result is not None
        assert "কাঁদা" in result
        assert "(User note: to cry)" in result

    def test_render_user_template_focused_words(self):
        from services.ai_service import render_user_template

        result = render_user_template(
            "focusedWords",
            {"sentence": "ছেলেটা বাজারে যাচ্ছে", "highlightedWords": "বাজারে"},
        )
        assert result is not None
        assert "ছেলেটা বাজারে যাচ্ছে" in result
        assert "বাজারে" in result
