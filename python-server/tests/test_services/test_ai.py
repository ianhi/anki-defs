"""Tests for AI service — prompt loading, rendering, and selection."""

from __future__ import annotations

from anki_defs.services.ai import (
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
        assert "englishToTarget" in prompts
        assert "englishToTargetFocused" in prompts

    def test_word_prompt_has_preamble(self):
        prompts = get_system_prompts(False)
        assert "Bangla language expert" in prompts["word"]

    def test_transliteration_disabled(self):
        prompts = get_system_prompts(False)
        assert "Do NOT include romanized" in prompts["word"]

    def test_transliteration_enabled(self):
        prompts = get_system_prompts(True)
        assert "Include romanized transliteration" in prompts["word"]

    def test_word_prompt_has_language_rules(self):
        prompts = get_system_prompts(False)
        assert "### Bangla-Specific Rules" in prompts["word"]
        assert "Lemmatization" in prompts["word"]
        assert "Spelling tolerance" in prompts["word"]

    def test_focused_prompt_has_lemma_example(self):
        prompts = get_system_prompts(False)
        assert "কেঁপে→কাঁপা" in prompts["focusedWords"]

    def test_english_to_target_has_guidelines(self):
        prompts = get_system_prompts(False)
        assert "MOST NATURAL Bangla word" in prompts["englishToTarget"]

    def test_sentence_prompt_has_skip_particles(self):
        """Verify sentence prompt renders correctly via get_system_prompts indirectly."""
        # sentence prompt is not in get_system_prompts, test via _render_prompt
        from anki_defs.services.ai import _prompt_templates, _render_prompt
        rendered = _render_prompt(_prompt_templates["sentence"]["system"], False)
        assert "আমি, তুমি, সে" in rendered
        assert "Bangla sentence" in rendered

    def test_relemmatize_has_language_rules(self):
        prompt = get_relemmatize_prompt("বাজারে")
        assert "Bangla dictionary/lemma form" in prompt
        assert "Bangla Lemmatization Rules" in prompt


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

    def test_english_to_target(self):
        result = render_user_template("englishToTarget", {"word": "market"})
        assert result is not None
        assert "market" in result

    def test_english_to_target_focused(self):
        result = render_user_template(
            "englishToTarget",
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

    def test_english_to_target(self):
        sel = select_prompt(self.prompts, "market", mode="english-to-target")
        assert sel.mode == "english-to-target"

    def test_english_to_target_focused(self):
        sel = select_prompt(
            self.prompts,
            "I went to the market",
            highlighted_words=["market"],
            mode="english-to-target",
        )
        assert sel.mode == "english-to-target-focused"


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
