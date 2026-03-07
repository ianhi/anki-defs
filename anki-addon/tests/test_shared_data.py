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
        assert "lemmaRules" in data
        assert "transliteration" in data
        assert "instruction" in data["transliteration"]
        assert "marker" in data["transliteration"]
        assert "true" in data["transliteration"]["instruction"]
        assert "false" in data["transliteration"]["instruction"]

    def test_single_word_prompt(self):
        data = self._load("single-word.json")
        assert "system" in data
        assert "{{lemmaRules}}" in data["system"]
        assert "{{transliterationInstruction}}" in data["system"]

    def test_sentence_prompt(self):
        data = self._load("sentence.json")
        assert "system" in data
        assert "{{lemmaRules}}" in data["system"]

    def test_focused_words_prompt(self):
        data = self._load("focused-words.json")
        assert "system" in data

    def test_card_extraction_prompt(self):
        data = self._load("card-extraction.json")
        assert "system" in data
        assert "{{lemmaRules}}" in data["system"]

    def test_define_prompt(self):
        data = self._load("define.json")
        assert "system" in data

    def test_analyze_prompt(self):
        data = self._load("analyze.json")
        assert "system" in data

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
        assert "sentence" in prompts
        assert "focusedWords" in prompts
        assert "extractCard" in prompts
        assert "define" in prompts
        assert "analyze" in prompts
        # Variables should be substituted
        for key, value in prompts.items():
            assert "{{lemmaRules}}" not in value, "Unsubstituted variable in {}".format(key)
            assert "{{transliterationInstruction}}" not in value
            assert "{{translitMarker}}" not in value
        # Without transliteration, should say "Do NOT"
        assert "Do NOT" in prompts["word"]

    def test_render_prompts_with_transliteration(self):
        from services.ai_service import get_system_prompts

        prompts = get_system_prompts(True)
        # With transliteration, should include instruction
        assert "Include romanized" in prompts["word"]
        assert "([transliteration])" in prompts["word"]
