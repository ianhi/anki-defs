package com.word2anki.ai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SharedPromptLoaderTest {

    private val testAssets = mapOf(
        "prompts/variables.json" to """
            {
              "lemmaRules": "Test lemma rules here.",
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
            {"system": "Define word.{{transliterationInstruction}}\n\n{{lemmaRules}}\n\nFormat: **[word]**{{translitMarker}}"}
        """.trimIndent(),
        "prompts/sentence.json" to """
            {"system": "Analyze sentence.{{transliterationInstruction}}\n\n{{lemmaRules}}"}
        """.trimIndent(),
        "prompts/focused-words.json" to """
            {"system": "Focus on words.{{transliterationInstruction}}", "user_template": "Sentence: {{sentence}}\n\nFocus words: {{highlightedWords}}"}
        """.trimIndent(),
        "prompts/card-extraction.json" to """
            {"system": "Extract card data.\n\n{{lemmaRules}}"}
        """.trimIndent(),
        "prompts/define.json" to """
            {"system": "Define JSON.{{transliterationInstruction}}\n\n{{lemmaRules}}"}
        """.trimIndent(),
        "prompts/analyze.json" to """
            {"system": "Analyze JSON.\n\n{{lemmaRules}}"}
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
        assertTrue(prompts.word.contains("([transliteration])"))
        assertTrue(prompts.word.contains("Test lemma rules here."))
    }

    @Test
    fun `getSystemPrompts with transliteration false excludes transliteration`() {
        val prompts = loader.getSystemPrompts(transliteration = false)
        assertTrue(prompts.word.contains("No transliteration."))
        assertFalse(prompts.word.contains("([transliteration])"))
    }

    @Test
    fun `getSystemPrompts returns all prompt types`() {
        val prompts = loader.getSystemPrompts(transliteration = true)
        assertTrue(prompts.word.contains("Define word."))
        assertTrue(prompts.sentence.contains("Analyze sentence."))
        assertTrue(prompts.focusedWords.contains("Focus on words."))
        assertTrue(prompts.extractCard.contains("Extract card data."))
        assertTrue(prompts.define.contains("Define JSON."))
        assertTrue(prompts.analyze.contains("Analyze JSON."))
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
    fun `lemmaRules are substituted in all relevant prompts`() {
        val prompts = loader.getSystemPrompts(transliteration = true)
        assertTrue(prompts.word.contains("Test lemma rules here."))
        assertTrue(prompts.sentence.contains("Test lemma rules here."))
        assertTrue(prompts.extractCard.contains("Test lemma rules here."))
        assertTrue(prompts.define.contains("Test lemma rules here."))
        assertTrue(prompts.analyze.contains("Test lemma rules here."))
    }
}
