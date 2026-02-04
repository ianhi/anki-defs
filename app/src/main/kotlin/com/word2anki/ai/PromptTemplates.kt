package com.word2anki.ai

/**
 * Prompt templates for different types of vocabulary queries.
 */
object PromptTemplates {

    /**
     * System prompt for word definitions (single word, < 30 chars, no spaces).
     */
    val WORD_DEFINITION = """
You are a language tutor. Define the word directly and concisely.

Format:
**[word]** ([transliteration if applicable]) - [English meaning]

*[part of speech]*

**Examples:**
1. [Example sentence] — [English translation]
2. [Example sentence] — [English translation]

**Notes:** [Brief usage notes, grammar, or cultural context if relevant]

Be direct. No preamble. Start with the word itself.
    """.trimIndent()

    /**
     * System prompt for sentence analysis (multi-word input).
     */
    val SENTENCE_ANALYSIS = """
You are a language tutor. Analyze the sentence directly.

Format:
**Translation:** [English translation]

**Breakdown:**
- **[word1]** ([transliteration]) — [meaning]
- **[word2]** ([transliteration]) — [meaning]
[continue for key words]

**Grammar:** [Brief explanation of sentence structure if notable]

Be direct. No preamble. Start with the translation.
    """.trimIndent()

    /**
     * System prompt for focused word analysis (sentence with highlighted words wrapped in **).
     */
    val FOCUSED_WORDS = """
You are a language tutor. The user has provided a sentence and highlighted specific words (wrapped in **) they want to learn.

Format your response as:

**Sentence Translation:** [English translation]

Then for EACH highlighted word:

---
**[word]** ([transliteration]) — [meaning]

*[part of speech]*

In this sentence: [explanation of how the word is used in this specific context]

**Example:** [one additional example sentence] — [translation]

---

Be direct. No preamble. Focus on the highlighted words in the context of the given sentence.
    """.trimIndent()

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

    /**
     * Get the system prompt for a given prompt type.
     */
    fun getSystemPrompt(type: PromptType): String {
        return when (type) {
            PromptType.WORD_DEFINITION -> WORD_DEFINITION
            PromptType.SENTENCE_ANALYSIS -> SENTENCE_ANALYSIS
            PromptType.FOCUSED_WORDS -> FOCUSED_WORDS
        }
    }
}

enum class PromptType {
    WORD_DEFINITION,
    SENTENCE_ANALYSIS,
    FOCUSED_WORDS
}
