package com.word2anki.ai

import org.junit.Assert.assertEquals
import org.junit.Test

class PromptTemplatesTest {

    @Test
    fun `single word without spaces returns WORD_DEFINITION`() {
        val result = PromptTemplates.getPromptType("hello")
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `single word with leading and trailing spaces returns WORD_DEFINITION`() {
        val result = PromptTemplates.getPromptType("  hello  ")
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `short word under 30 chars returns WORD_DEFINITION`() {
        val result = PromptTemplates.getPromptType("supercalifragilistic")
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `sentence with spaces returns SENTENCE_ANALYSIS`() {
        val result = PromptTemplates.getPromptType("The quick brown fox")
        assertEquals(PromptType.SENTENCE_ANALYSIS, result)
    }

    @Test
    fun `long text returns SENTENCE_ANALYSIS`() {
        val result = PromptTemplates.getPromptType("This is a longer piece of text that should be analyzed as a sentence.")
        assertEquals(PromptType.SENTENCE_ANALYSIS, result)
    }

    @Test
    fun `text with highlighted words returns FOCUSED_WORDS`() {
        val result = PromptTemplates.getPromptType("The **quick** brown **fox** jumps")
        assertEquals(PromptType.FOCUSED_WORDS, result)
    }

    @Test
    fun `single highlighted word returns FOCUSED_WORDS`() {
        val result = PromptTemplates.getPromptType("**hello**")
        assertEquals(PromptType.FOCUSED_WORDS, result)
    }

    @Test
    fun `highlighted word in sentence returns FOCUSED_WORDS`() {
        val result = PromptTemplates.getPromptType("I want to learn **vocabulary** today")
        assertEquals(PromptType.FOCUSED_WORDS, result)
    }

    @Test
    fun `empty string returns WORD_DEFINITION`() {
        val result = PromptTemplates.getPromptType("")
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `whitespace only returns WORD_DEFINITION`() {
        val result = PromptTemplates.getPromptType("   ")
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `non-English word returns WORD_DEFINITION`() {
        val result = PromptTemplates.getPromptType("বাংলা")
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `non-English sentence returns SENTENCE_ANALYSIS`() {
        val result = PromptTemplates.getPromptType("আমি বাংলায় গান গাই")
        assertEquals(PromptType.SENTENCE_ANALYSIS, result)
    }

    @Test
    fun `word at exactly 29 chars without spaces returns WORD_DEFINITION`() {
        val result = PromptTemplates.getPromptType("a".repeat(29))
        assertEquals(PromptType.WORD_DEFINITION, result)
    }

    @Test
    fun `word at exactly 30 chars without spaces returns SENTENCE_ANALYSIS`() {
        val result = PromptTemplates.getPromptType("a".repeat(30))
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
        assertEquals(PromptType.SENTENCE_ANALYSIS, result)
    }
}
