package com.word2anki.ai

import com.word2anki.data.models.CardPreview
import org.json.JSONObject

/**
 * Extracts flashcard data from AI responses.
 */
object CardExtractor {

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
            val wordMatch = Regex("\\*\\*([^*]+)\\*\\*").find(aiResponse)
            val word = wordMatch?.groupValues?.get(1)?.split(" ")?.firstOrNull()
                ?: userInput.trim().split(" ").firstOrNull()
                ?: return null

            // Try to extract definition (text after the word, before newline)
            val lines = aiResponse.lines()
            var definition = ""
            var exampleSentence = ""
            var sentenceTranslation = ""

            for (line in lines) {
                val trimmedLine = line.trim()

                // Look for definition pattern: **word** - definition or **word** (trans) - definition
                if (trimmedLine.contains(word) && trimmedLine.contains(" - ")) {
                    val parts = trimmedLine.split(" - ", limit = 2)
                    if (parts.size > 1) {
                        definition = parts[1].trim()
                    }
                }

                // Look for example sentences (numbered list or after **Examples:**)
                if (trimmedLine.startsWith("1.") || trimmedLine.startsWith("- ")) {
                    // Split on em-dash or en-dash or spaced hyphen to separate example from translation
                    val exampleParts = trimmedLine
                        .removePrefix("1.")
                        .removePrefix("- ")
                        .split(Regex(" [—–-] "))
                    if (exampleParts.isNotEmpty() && exampleSentence.isEmpty()) {
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
