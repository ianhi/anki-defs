"""Tests for AI service — prompt loading, rendering, and selection."""

from __future__ import annotations

from unittest.mock import patch

from anki_defs.services.ai import (
    _default_language,
    get_available_languages,
    get_language_for_deck,
    get_relemmatize_prompt,
    get_system_prompts,
    parse_json_response,
    render_user_template,
    select_prompt,
)


class TestPromptLoading:
    def test_system_prompts_loaded(self):
        prompts = get_system_prompts(False)
        assert "word" in prompts
        assert "focusedWords" in prompts
        assert "englishToBangla" in prompts
        assert "englishToBanglaFocused" in prompts

    def test_word_prompt_has_preamble(self):
        prompts = get_system_prompts(False)
        assert "language expert" in prompts["word"]

    def test_transliteration_disabled(self):
        prompts = get_system_prompts(False)
        assert "Do NOT include romanized" in prompts["word"]

    def test_transliteration_enabled(self):
        prompts = get_system_prompts(True)
        assert "Include romanized transliteration" in prompts["word"]


class TestRenderUserTemplate:
    def test_single_word(self):
        result = render_user_template("word", {"word": "বাজার"})
        assert result is not None
        assert "বাজার" in result

    def test_with_context(self):
        result = render_user_template("word", {"word": "বাজার", "userContext": "market near home"})
        assert result is not None
        assert "User note: market near home" in result

    def test_focused_words(self):
        result = render_user_template(
            "focusedWords",
            {"sentence": "সে বাজারে গেল", "highlightedWords": "বাজারে, গেল"},
        )
        assert result is not None
        assert "সে বাজারে গেল" in result
        assert "বাজারে, গেল" in result

    def test_english_to_bangla(self):
        result = render_user_template("englishToBangla", {"word": "market"})
        assert result is not None
        assert "market" in result

    def test_english_to_bangla_focused(self):
        result = render_user_template(
            "englishToBangla",
            {"sentence": "I went to the market", "highlightedWords": "market"},
            "focused",
        )
        assert result is not None
        assert "I went to the market" in result

    def test_nonexistent_template(self):
        result = render_user_template("nonexistent", {"word": "test"})
        assert result is None


class TestSelectPrompt:
    def setup_method(self):
        self.prompts = get_system_prompts(False)

    def test_single_word(self):
        sel = select_prompt(self.prompts, "বাজার")
        assert sel.mode == "single-word"
        assert "বাজার" in sel.user_message

    def test_focused_words(self):
        sel = select_prompt(
            self.prompts, "সে বাজারে গেল", highlighted_words=["বাজারে", "গেল"]
        )
        assert sel.mode == "focused-words"

    def test_sentence_blocked(self):
        sel = select_prompt(self.prompts, "সে বাজারে গেল")
        assert sel.mode == "sentence-blocked"

    def test_english_to_bangla(self):
        sel = select_prompt(self.prompts, "market", mode="english-to-bangla")
        assert sel.mode == "english-to-bangla"

    def test_english_to_bangla_focused(self):
        sel = select_prompt(
            self.prompts,
            "I went to the market",
            highlighted_words=["market"],
            mode="english-to-bangla",
        )
        assert sel.mode == "english-to-bangla-focused"


class TestRelemmatize:
    def test_basic(self):
        prompt = get_relemmatize_prompt("বাজারে")
        assert "বাজারে" in prompt

    def test_with_context(self):
        prompt = get_relemmatize_prompt("বাজারে", "সে বাজারে গেল")
        assert "Context sentence:" in prompt
        assert "সে বাজারে গেল" in prompt


class TestParseJsonResponse:
    def test_plain_json(self):
        result = parse_json_response('{"word": "test"}')
        assert result["word"] == "test"

    def test_code_fenced(self):
        result = parse_json_response('```json\n{"word": "test"}\n```')
        assert result["word"] == "test"

    def test_array(self):
        result = parse_json_response('[{"word": "a"}, {"word": "b"}]')
        assert len(result) == 2


class TestLanguageForDeck:
    def test_exact_match(self):
        settings = {
            "deckLanguages": {"Spanish": "es"},
            "targetLanguage": "bn",
        }
        with patch("anki_defs.services.ai.get_settings", return_value=settings):
            lang = get_language_for_deck("Spanish")
            assert lang["code"] == "es"

    def test_inheritance(self):
        settings = {
            "deckLanguages": {"Languages": "bn", "Languages::Spanish": "es"},
            "targetLanguage": "bn",
        }
        with patch("anki_defs.services.ai.get_settings", return_value=settings):
            # Subdeck inherits from parent when no exact match
            lang = get_language_for_deck("Languages::Spanish::Verbs")
            assert lang["code"] == "es"

    def test_inheritance_walks_up(self):
        settings = {
            "deckLanguages": {"Languages": "fr"},
            "targetLanguage": "bn",
        }
        with patch("anki_defs.services.ai.get_settings", return_value=settings):
            lang = get_language_for_deck("Languages::Spanish::Verbs")
            assert lang["code"] == "fr"

    def test_fallback_to_target_language(self):
        settings = {
            "deckLanguages": {},
            "targetLanguage": "bn",
        }
        with patch("anki_defs.services.ai.get_settings", return_value=settings):
            lang = get_language_for_deck("UnmappedDeck")
            assert lang["code"] == "bn"

    def test_fallback_no_deck_languages(self):
        settings = {"targetLanguage": "hi"}
        with patch("anki_defs.services.ai.get_settings", return_value=settings):
            lang = get_language_for_deck("SomeDeck")
            assert lang["code"] == "hi"


class TestAvailableLanguages:
    def test_returns_list(self):
        langs = get_available_languages()
        assert isinstance(langs, list)
        # Each entry should have code, name, nativeName
        for lang in langs:
            assert "code" in lang
            assert "name" in lang
            assert "nativeName" in lang


class TestRenderPromptWithLanguage:
    def test_explicit_language_overrides_preamble(self):
        lang = _default_language("es", "Spanish")
        prompts = get_system_prompts(False, language=lang)
        assert "Spanish language expert" in prompts["word"]

    def test_none_language_uses_default(self):
        prompts = get_system_prompts(False, language=None)
        # Should not crash, uses default language
        assert "word" in prompts


class TestDefaultLanguage:
    def test_produces_valid_dict(self):
        lang = _default_language("hi", "Hindi")
        assert lang["code"] == "hi"
        assert lang["name"] == "Hindi"
        assert lang["nativeName"] == "Hindi"
        assert "Hindi" in lang["preamble"]
        assert lang["lemmatizationRules"] != ""
        assert "instruction" in lang["transliteration"]
        assert "marker" in lang["transliteration"]
        assert "true" in lang["transliteration"]["instruction"]
        assert "false" in lang["transliteration"]["instruction"]

    def test_transliteration_contains_language_name(self):
        lang = _default_language("ko", "Korean")
        assert "Korean" in lang["transliteration"]["instruction"]["true"]
