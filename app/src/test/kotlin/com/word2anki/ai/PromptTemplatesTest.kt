package com.word2anki.ai

import org.junit.Assert.assertEquals
import org.junit.Test

class PromptTemplatesTest {

    @Test
    fun `single word without spaces returns WORD_DEFINITION`() {
        val input = "hello"
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `single word with leading and trailing spaces returns WORD_DEFINITION`() {
        val input = "  hello  "
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `short word under 30 chars returns WORD_DEFINITION`() {
        val input = "supercalifragilistic"
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `sentence with spaces returns SENTENCE_ANALYSIS`() {
        val input = "The quick brown fox"
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.SENTENCE_ANALYSIS, result)
    }

    @Test
    fun `long text returns SENTENCE_ANALYSIS`() {
        val input = "This is a longer piece of text that should be analyzed as a sentence."
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.SENTENCE_ANALYSIS, result)
    }

    @Test
    fun `text with highlighted words returns FOCUSED_WORDS`() {
        val input = "The **quick** brown **fox** jumps"
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.FOCUSED_WORDS, result)
    }

    @Test
    fun `single highlighted word returns FOCUSED_WORDS`() {
        val input = "**hello**"
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.FOCUSED_WORDS, result)
    }

    @Test
    fun `highlighted word in sentence returns FOCUSED_WORDS`() {
        val input = "I want to learn **vocabulary** today"
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.FOCUSED_WORDS, result)
    }

    @Test
    fun `empty string returns WORD_DEFINITION`() {
        val input = ""
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `whitespace only returns WORD_DEFINITION`() {
        val input = "   "
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `non-English word returns WORD_DEFINITION`() {
        val input = "বাংলা"
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `non-English sentence returns SENTENCE_ANALYSIS`() {
        val input = "আমি বাংলায় গান গাই"
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.SENTENCE_ANALYSIS, result)
    }

    @Test
    fun `getSystemPrompt returns correct prompt for WORD_DEFINITION`() {
        val prompt = PromptTemplates.getSystemPrompt(PromptType.WORD_DEFINITION)
        assert(prompt.contains("Define the word"))
    }

    @Test
    fun `getSystemPrompt returns correct prompt for SENTENCE_ANALYSIS`() {
        val prompt = PromptTemplates.getSystemPrompt(PromptType.SENTENCE_ANALYSIS)
        assert(prompt.contains("Analyze the sentence"))
    }

    @Test
    fun `getSystemPrompt returns correct prompt for FOCUSED_WORDS`() {
        val prompt = PromptTemplates.getSystemPrompt(PromptType.FOCUSED_WORDS)
        assert(prompt.contains("highlighted"))
    }

    // Tests for new unified system prompt and type hints

    @Test
    fun `getUnifiedSystemPrompt returns prompt without language note by default`() {
        val prompt = PromptTemplates.getUnifiedSystemPrompt()
        assert(prompt.contains("language tutor"))
        assert(!prompt.contains("The user is learning"))
    }

    @Test
    fun `getUnifiedSystemPrompt includes target language when provided`() {
        val prompt = PromptTemplates.getUnifiedSystemPrompt("Bangla")
        assert(prompt.contains("The user is learning Bangla"))
    }

    @Test
    fun `getUnifiedSystemPrompt covers all input types`() {
        val prompt = PromptTemplates.getUnifiedSystemPrompt()
        assert(prompt.contains("Single word"))
        assert(prompt.contains("Sentence"))
        assert(prompt.contains("highlighted"))
        assert(prompt.contains("Follow-up"))
    }

    @Test
    fun `getTypeHint returns word hint for single word`() {
        val hint = PromptTemplates.getTypeHint("hello")
        assert(hint.contains("Define"))
    }

    @Test
    fun `getTypeHint returns sentence hint for sentence`() {
        val hint = PromptTemplates.getTypeHint("The quick brown fox")
        assert(hint.contains("Analyze"))
    }

    @Test
    fun `getTypeHint returns focused hint for highlighted words`() {
        val hint = PromptTemplates.getTypeHint("The **quick** fox")
        assert(hint.contains("highlighted"))
    }

    @Test
    fun `word at exactly 29 chars without spaces returns WORD_DEFINITION`() {
        val input = "a".repeat(29)
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `word at exactly 30 chars without spaces returns SENTENCE_ANALYSIS`() {
        val input = "a".repeat(30)
        val result = PromptTemplates.getPromptType(input)
        assertEquals(PromptType.SENTENCE_ANALYSIS, result)
    }

    @Test
    fun `punctuation-only input returns WORD_DEFINITION`() {
        val result = PromptTemplates.getPromptType("!")
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `single asterisk does not trigger FOCUSED_WORDS`() {
        val result = PromptTemplates.getPromptType("hello * world")
        // Single asterisk isn't ** so should not be FOCUSED_WORDS
        assertEquals(PromptType.SENTENCE_ANALYSIS, result)
    }

    @Test
    fun `getUnifiedSystemPrompt includes formatting guidelines`() {
        val prompt = PromptTemplates.getUnifiedSystemPrompt()
        assert(prompt.contains("bold"))
        assert(prompt.contains("italics"))
        assert(prompt.contains(" — "))
    }
}
