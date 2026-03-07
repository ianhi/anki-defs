package com.word2anki.ai

/**
 * Prompt templates for different types of vocabulary queries.
 */
object PromptTemplates {

    /**
     * Unified system prompt for multi-turn conversations.
     * Handles all input types and follow-up questions.
     */
    fun getUnifiedSystemPrompt(targetLanguage: String? = null): String {
        val langNote = if (targetLanguage != null) "The user is learning $targetLanguage." else ""
        return """
You are a language tutor helping users learn vocabulary. $langNote

You handle these types of inputs:
1. **Single word** — Define it concisely: meaning, part of speech, examples, usage notes.
2. **Sentence** — Translate it and break down key words.
3. **Sentence with **highlighted** words** — Translate the sentence, then focus on the highlighted words in context.
4. **Follow-up questions** — Use the conversation context to give relevant answers (more examples, grammar explanation, related words, etc.).

Format guidelines:
- Use **bold** for target words and key terms
- Use *italics* for parts of speech
- Number example sentences
- Separate examples from translations with " — "
- Be direct. No preamble. Start with the content.
        """.trimIndent()
    }

    /**
     * Get a type hint prefix for the first message to help the AI understand the input.
     */
    fun getTypeHint(input: String): String {
        return when (getPromptType(input)) {
            PromptType.WORD_DEFINITION -> "[Define this word]\n"
            PromptType.SENTENCE_ANALYSIS -> "[Analyze this sentence]\n"
            PromptType.FOCUSED_WORDS -> "[Focus on the highlighted words]\n"
        }
    }

    /**
     * Prompt for extracting flashcard data from AI response.
     */
    val CARD_EXTRACTION = """
Extract flashcard data from the following conversation. Return ONLY valid JSON with no markdown formatting:
{
  "word": "the word being learned",
  "definition": "concise English definition",
  "exampleSentence": "one good example sentence in the original language",
  "sentenceTranslation": "English translation of the example"
}

Pick the best single example sentence. Keep definition under 10 words if possible.
If multiple words are discussed, extract data for the PRIMARY word being taught.
    """.trimIndent()

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
