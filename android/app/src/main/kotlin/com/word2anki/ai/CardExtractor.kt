package com.word2anki.ai

import com.word2anki.data.models.CardPreview
import org.json.JSONException
import org.json.JSONObject

/**
 * Extracts flashcard data from AI responses.
 */
object CardExtractor {

    private val BOLD_WORD = Regex("\\*\\*([^*]+)\\*\\*")
    private val DASH_SEPARATOR = Regex(" [—–-] ")

    /**
     * Parse JSON response from extraction prompt into CardPreview.
     */
    fun parseCardJson(json: String): CardPreview? {
        return try {
            val cleanJson = json
                .replace("```json", "")
                .replace("```", "")
                .trim()

            val jsonObject = JSONObject(cleanJson)
            CardPreview(
                word = jsonObject.optString("word", ""),
                definition = jsonObject.optString("definition", ""),
                exampleSentence = jsonObject.optString("exampleSentence", ""),
                sentenceTranslation = jsonObject.optString("sentenceTranslation", "")
            )
        } catch (e: JSONException) {
            null
        }
    }

    /**
     * Try to extract card data directly from AI response without additional API call.
     * Uses simple heuristics to find the word, definition, and example.
     */
    fun extractFromResponse(userInput: String, aiResponse: String): CardPreview? {
        return try {
            val word = extractWord(aiResponse, userInput) ?: return null
            val definition = extractDefinition(aiResponse, word)
            val (example, translation) = extractExample(aiResponse, definition.isNotEmpty())

            if (word.isNotEmpty() && definition.isNotEmpty()) {
                CardPreview(
                    word = word.replace("*", ""),
                    definition = definition.replace("*", ""),
                    exampleSentence = example.replace("*", ""),
                    sentenceTranslation = translation.replace("*", "")
                )
            } else {
                null
            }
        } catch (e: IndexOutOfBoundsException) {
            null
        }
    }

    /**
     * Extract the primary word being taught.
     * Looks for the first bold text, falls back to the first word of user input.
     */
    internal fun extractWord(aiResponse: String, userInput: String): String? {
        val boldMatch = BOLD_WORD.find(aiResponse)
        return boldMatch?.groupValues?.get(1)?.split(" ")?.firstOrNull()
            ?: userInput.trim().split(" ").firstOrNull()
    }

    /**
     * Extract the definition from the response by finding a dash-separated pattern
     * on a line containing the target word.
     */
    internal fun extractDefinition(aiResponse: String, word: String): String {
        for (line in aiResponse.lines()) {
            val trimmed = line.trim()
            if (trimmed.contains(word)) {
                val defMatch = DASH_SEPARATOR.find(trimmed)
                if (defMatch != null) {
                    return trimmed.substring(defMatch.range.last + 1).trim()
                }
            }
        }
        return ""
    }

    /**
     * Extract the first example sentence and its translation from numbered or bulleted lists.
     * Returns Pair(exampleSentence, sentenceTranslation).
     */
    internal fun extractExample(aiResponse: String, hasDefinition: Boolean): Pair<String, String> {
        var foundExamplesHeader = false

        for (line in aiResponse.lines()) {
            val trimmed = line.trim()

            if (trimmed.contains("Example", ignoreCase = true) && trimmed.contains("**")) {
                foundExamplesHeader = true
            }

            if ((foundExamplesHeader || hasDefinition) &&
                (trimmed.startsWith("1.") || trimmed.startsWith("- "))
            ) {
                val exampleText = trimmed
                    .removePrefix("1.")
                    .removePrefix("- ")
                    .trim()
                val parts = exampleText.split(DASH_SEPARATOR)
                val sentence = parts.getOrElse(0) { "" }.trim()
                val translation = parts.getOrElse(1) { "" }.trim()
                return sentence to translation
            }
        }
        return "" to ""
    }

    /**
     * Build the extraction prompt with conversation context.
     */
    fun buildExtractionPrompt(
        userInput: String,
        aiResponse: String,
        extractionPromptText: String
    ): String {
        return """
$extractionPromptText

User asked about: $userInput

AI Response:
$aiResponse
        """.trimIndent()
    }
}
