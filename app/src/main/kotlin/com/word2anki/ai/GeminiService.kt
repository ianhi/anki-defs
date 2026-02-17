package com.word2anki.ai

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content
import com.google.ai.client.generativeai.type.generationConfig
import com.word2anki.data.models.CardPreview
import com.word2anki.data.models.Message
import com.word2anki.data.models.MessageRole
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.withTimeout

/**
 * Service for interacting with Google's Gemini API.
 *
 * Note: Using SDK 0.9.0 which doesn't support systemInstruction parameter
 * with newer models. System prompt is prepended to the first user message instead.
 */
class GeminiService(private val apiKey: String) {

    private val model: GenerativeModel by lazy {
        GenerativeModel(
            modelName = "gemini-2.5-flash",
            apiKey = apiKey,
            generationConfig = generationConfig {
                temperature = 0.7f
                maxOutputTokens = 1024
            }
        )
    }

    private val extractionModel: GenerativeModel by lazy {
        GenerativeModel(
            modelName = "gemini-2.5-flash",
            apiKey = apiKey,
            generationConfig = generationConfig {
                temperature = 0.1f
                maxOutputTokens = 256
            }
        )
    }

    /**
     * Generate a streaming response with conversation history for multi-turn context.
     * System prompt is prepended to the first user message since SDK 0.9.0 doesn't
     * reliably support the systemInstruction parameter with newer models.
     */
    fun generateStreamingResponse(input: String, history: List<Message> = emptyList()): Flow<String> {
        val systemPrompt = PromptTemplates.getUnifiedSystemPrompt()

        return flow {
            withTimeout(STREAMING_TIMEOUT_MS) {
                if (history.isEmpty()) {
                    // First message: prepend system prompt + type hint
                    val typeHint = PromptTemplates.getTypeHint(input)
                    val fullPrompt = "$systemPrompt\n\n$typeHint$input"
                    val chat = model.startChat()
                    chat.sendMessageStream(fullPrompt).collect { response ->
                        response.text?.let { emit(it) }
                    }
                } else {
                    // Multi-turn: prepend system prompt to the first user message in history
                    val chatHistory = history.mapIndexed { index, msg ->
                        val messageContent = if (index == 0 && msg.role == MessageRole.USER) {
                            "$systemPrompt\n\n${msg.content}"
                        } else {
                            msg.content
                        }
                        content(role = if (msg.role == MessageRole.USER) "user" else "model") {
                            text(messageContent)
                        }
                    }
                    val chat = model.startChat(chatHistory)
                    chat.sendMessageStream(input).collect { response ->
                        response.text?.let { emit(it) }
                    }
                }
            }
        }
    }

    /**
     * Extract card data from conversation using AI.
     */
    suspend fun extractCard(userInput: String, aiResponse: String): CardPreview? {
        // First try simple extraction without API call
        val simpleExtraction = CardExtractor.extractFromResponse(userInput, aiResponse)
        if (simpleExtraction != null &&
            simpleExtraction.definition.isNotEmpty() &&
            simpleExtraction.exampleSentence.isNotEmpty()) {
            return simpleExtraction
        }

        // Fall back to AI extraction with timeout
        return try {
            withTimeout(EXTRACTION_TIMEOUT_MS) {
                val extractionPrompt = CardExtractor.buildExtractionPrompt(userInput, aiResponse)
                val response = extractionModel.generateContent(extractionPrompt)
                response.text?.let { CardExtractor.parseCardJson(it) }
            }
        } catch (e: Exception) {
            simpleExtraction // Return simple extraction if available, even if incomplete
        }
    }

    companion object {
        private const val STREAMING_TIMEOUT_MS = 60_000L
        private const val EXTRACTION_TIMEOUT_MS = 15_000L

        /**
         * Validate if an API key appears to be valid format.
         * Does not make an API call.
         */
        fun isValidApiKeyFormat(apiKey: String): Boolean {
            return apiKey.isNotBlank() && apiKey.length >= 20
        }
    }
}
