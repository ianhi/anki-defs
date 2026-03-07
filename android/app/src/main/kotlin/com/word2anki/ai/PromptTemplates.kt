package com.word2anki.ai

/**
 * Input classification logic for vocabulary queries.
 * Prompt content now comes from SharedPromptLoader (shared/prompts/*.json).
 */
object PromptTemplates {

    /**
     * Determine which prompt template to use based on input.
     */
    fun getPromptType(input: String): PromptType {
        val trimmed = input.trim()
        return when {
            // Check for highlighted words (wrapped in **)
            trimmed.contains("**") -> PromptType.FOCUSED_WORDS
            // Single word: less than 30 chars, no spaces (excluding punctuation)
            trimmed.length < 30 && !trimmed.contains(' ') -> PromptType.WORD_DEFINITION
            // Everything else is sentence analysis
            else -> PromptType.SENTENCE_ANALYSIS
        }
    }
}

enum class PromptType {
    WORD_DEFINITION,
    SENTENCE_ANALYSIS,
    FOCUSED_WORDS
}
