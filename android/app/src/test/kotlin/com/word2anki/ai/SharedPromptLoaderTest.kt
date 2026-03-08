package com.word2anki.ai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SharedPromptLoaderTest {

    private val testAssets = mapOf(
        "prompts/variables.json" to """
            {
              "preamble": "Test preamble here.",
              "outputRules": "Test output rules here.",
              "languageRules": "Test language rules here.",
              "transliteration": {
                "instruction": {
                  "true": " Include transliteration.",
                  "false": " No transliteration."
                },
                "marker": {
                  "true": " ([transliteration])",
                  "false": ""
                }
              }
            }
        """.trimIndent(),
        "prompts/single-word.json" to """
            {"system": "{{preamble}} Define word.{{transliterationInstruction}}\n\n{{languageRules}}\n\n{{outputRules}}", "user_template": "{{word}}{{userContext}}"}
        """.trimIndent(),
        "prompts/focused-words.json" to """
            {"system": "{{preamble}} Focus on words.{{transliterationInstruction}}\n\n{{languageRules}}\n\n{{outputRules}}", "user_template": "Sentence: {{sentence}}\n\nFocus words: {{highlightedWords}}"}
        """.trimIndent(),
        "prompts/relemmatize.json" to """
            {"system": "Relemmatize \"{{word}}\".{{context}}"}
        """.trimIndent()
    )

    private val loader = SharedPromptLoader { path -> testAssets.getValue(path) }

    @Test
    fun `getSystemPrompts with transliteration true includes transliteration instruction`() {
        val prompts = loader.getSystemPrompts(transliteration = true)
        assertTrue(prompts.word.contains("Include transliteration."))
    }

    @Test
    fun `getSystemPrompts with transliteration false excludes transliteration`() {
        val prompts = loader.getSystemPrompts(transliteration = false)
        assertTrue(prompts.word.contains("No transliteration."))
        assertFalse(prompts.word.contains("Include transliteration."))
    }

    @Test
    fun `getSystemPrompts renders preamble`() {
        val prompts = loader.getSystemPrompts(transliteration = true)
        assertTrue(prompts.word.contains("Test preamble here."))
        assertTrue(prompts.focusedWords.contains("Test preamble here."))
    }

    @Test
    fun `getSystemPrompts renders outputRules`() {
        val prompts = loader.getSystemPrompts(transliteration = true)
        assertTrue(prompts.word.contains("Test output rules here."))
    }

    @Test
    fun `getSystemPrompts renders languageRules`() {
        val prompts = loader.getSystemPrompts(transliteration = true)
        assertTrue(prompts.word.contains("Test language rules here."))
    }

    @Test
    fun `getSystemPrompts returns word and focusedWords prompts`() {
        val prompts = loader.getSystemPrompts(transliteration = true)
        assertTrue(prompts.word.contains("Define word."))
        assertTrue(prompts.focusedWords.contains("Focus on words."))
    }

    @Test
    fun `getRelemmatizePrompt substitutes word`() {
        val prompt = loader.getRelemmatizePrompt("কাঁদতে")
        assertTrue(prompt.contains("কাঁদতে"))
        assertFalse(prompt.contains("{{word}}"))
    }

    @Test
    fun `getRelemmatizePrompt includes context when sentence provided`() {
        val prompt = loader.getRelemmatizePrompt("কাঁদতে", "সে কাঁদতে শুরু করল")
        assertTrue(prompt.contains("Context sentence: সে কাঁদতে শুরু করল"))
    }

    @Test
    fun `getRelemmatizePrompt omits context when no sentence`() {
        val prompt = loader.getRelemmatizePrompt("কাঁদতে")
        assertFalse(prompt.contains("Context sentence"))
    }

    @Test
    fun `getFocusedWordsUserTemplate substitutes variables`() {
        val result = loader.getFocusedWordsUserTemplate("আমি বাড়ি যাব", "বাড়ি, যাব")
        assertEquals("Sentence: আমি বাড়ি যাব\n\nFocus words: বাড়ি, যাব", result)
    }

    @Test
    fun `getWordUserTemplate returns word without context`() {
        val result = loader.getWordUserTemplate("বাজার")
        assertEquals("বাজার", result)
    }

    @Test
    fun `getWordUserTemplate includes user context when provided`() {
        val result = loader.getWordUserTemplate("বাজার", "like a marketplace")
        assertTrue(result.contains("বাজার"))
        assertTrue(result.contains("(User note: like a marketplace)"))
    }
}
