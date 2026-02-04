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
}
