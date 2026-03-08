package com.word2anki.ai

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content
import com.google.ai.client.generativeai.type.generationConfig
import kotlinx.coroutines.withTimeout

/**
 * Service for interacting with Google's Gemini API.
 *
 * Uses JSON-first pipeline: single non-streaming call with responseMimeType = "application/json".
 */
class GeminiService(private val apiKey: String) {

    private val jsonModel: GenerativeModel by lazy {
        GenerativeModel(
            modelName = MODEL_NAME,
            apiKey = apiKey,
            generationConfig = generationConfig {
                temperature = 0.7f
                maxOutputTokens = 2048
                responseMimeType = "application/json"
            }
        )
    }

    private val textModel: GenerativeModel by lazy {
        GenerativeModel(
            modelName = MODEL_NAME,
            apiKey = apiKey,
            generationConfig = generationConfig {
                temperature = 0.7f
                maxOutputTokens = 1024
            }
        )
    }

    /**
     * Single non-streaming JSON completion call.
     * System prompt is prepended to the user message since SDK 0.9.0 doesn't
     * reliably support the systemInstruction parameter with newer models.
     *
     * @return Pair of (raw JSON text, usage info map)
     */
    suspend fun getJsonCompletion(
        systemPrompt: String,
        userMessage: String
    ): Pair<String, Map<String, Int>?> {
        return withTimeout(COMPLETION_TIMEOUT_MS) {
            val message = "$systemPrompt\n\n$userMessage"
            val response = jsonModel.generateContent(
                content(role = "user") { text(message) }
            )
            val text = response.text ?: throw Exception("Empty response from Gemini")
            val usage = response.usageMetadata?.let { meta ->
                mapOf(
                    "inputTokens" to meta.promptTokenCount,
                    "outputTokens" to meta.candidatesTokenCount
                )
            }
            Pair(text, usage)
        }
    }

    /**
     * Simple text completion for non-JSON endpoints (relemmatize, etc.).
     */
    suspend fun getCompletion(
        systemPrompt: String,
        userMessage: String
    ): String {
        return withTimeout(COMPLETION_TIMEOUT_MS) {
            val message = "$systemPrompt\n\n$userMessage"
            val response = textModel.generateContent(
                content(role = "user") { text(message) }
            )
            response.text ?: throw Exception("Empty response from Gemini")
        }
    }

    companion object {
        private const val MODEL_NAME = "gemini-2.5-flash"
        private const val COMPLETION_TIMEOUT_MS = 60_000L
    }
}
