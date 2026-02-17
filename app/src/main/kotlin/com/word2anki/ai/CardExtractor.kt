package com.word2anki.ai

import com.word2anki.data.models.CardPreview
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
            // Clean up the JSON string (remove markdown code blocks if present)
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
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Try to extract card data directly from AI response without additional API call.
     * Uses simple heuristics to find the word and definition.
     */
    fun extractFromResponse(userInput: String, aiResponse: String): CardPreview? {
        return try {
            // Try to find the main word (usually the first bold text)
            val wordMatch = BOLD_WORD.find(aiResponse)
            val word = wordMatch?.groupValues?.get(1)?.split(" ")?.firstOrNull()
                ?: userInput.trim().split(" ").firstOrNull()
                ?: return null

            // Try to extract definition (text after the word, before newline)
            val lines = aiResponse.lines()
            var definition = ""
            var exampleSentence = ""
            var sentenceTranslation = ""
            var foundExamplesHeader = false

            for (line in lines) {
                val trimmedLine = line.trim()

                // Track when we've passed an Examples header
                if (trimmedLine.contains("Example", ignoreCase = true) && trimmedLine.contains("**")) {
                    foundExamplesHeader = true
                }

                // Look for definition pattern using various separators:
                // **word** - definition, **word** — definition, **word** (trans) — definition
                if (definition.isEmpty() && trimmedLine.contains(word)) {
                    val defMatch = DASH_SEPARATOR.find(trimmedLine)
                    if (defMatch != null) {
                        definition = trimmedLine.substring(defMatch.range.last + 1).trim()
                    }
                }

                // Look for example sentences (numbered list or bullet, preferably after Examples header)
                // Also accept 1. lines after we've found a definition (common in simpler responses)
                if (exampleSentence.isEmpty() && (foundExamplesHeader || definition.isNotEmpty()) &&
                    (trimmedLine.startsWith("1.") || trimmedLine.startsWith("- "))) {
                    val exampleText = trimmedLine
                        .removePrefix("1.")
                        .removePrefix("- ")
                        .trim()
                    val exampleParts = exampleText.split(DASH_SEPARATOR)
                    if (exampleParts.isNotEmpty()) {
                        exampleSentence = exampleParts[0].trim()
                        if (exampleParts.size > 1) {
                            sentenceTranslation = exampleParts[1].trim()
                        }
                    }
                }
            }

            // Only return if we have at least a word and definition
            if (word.isNotEmpty() && definition.isNotEmpty()) {
                CardPreview(
                    word = word.replace("*", ""),
                    definition = definition.replace("*", ""),
                    exampleSentence = exampleSentence.replace("*", ""),
                    sentenceTranslation = sentenceTranslation.replace("*", "")
                )
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Build the extraction prompt with conversation context.
     */
    fun buildExtractionPrompt(userInput: String, aiResponse: String): String {
        return """
${PromptTemplates.CARD_EXTRACTION}

User asked about: $userInput

AI Response:
$aiResponse
        """.trimIndent()
    }
}
