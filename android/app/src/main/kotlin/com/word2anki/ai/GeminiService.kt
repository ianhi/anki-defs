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
            modelName = MODEL_NAME,
            apiKey = apiKey,
            generationConfig = generationConfig {
                temperature = 0.7f
                maxOutputTokens = 1024
            }
        )
    }

    private val extractionModel: GenerativeModel by lazy {
        GenerativeModel(
            modelName = MODEL_NAME,
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
    fun generateStreamingResponse(
        input: String,
        systemPrompt: String,
        history: List<Message> = emptyList()
    ): Flow<String> {
        return flow {
            withTimeout(STREAMING_TIMEOUT_MS) {
                val chat: com.google.ai.client.generativeai.Chat
                val message: String

                if (history.isEmpty()) {
                    chat = model.startChat()
                    message = "$systemPrompt\n\n$input"
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
                    chat = model.startChat(chatHistory)
                    message = input
                }

                chat.sendMessageStream(message).collect { response ->
                    response.text?.let { emit(it) }
                }
            }
        }
    }

    /**
     * Extract card data from conversation using AI.
     */
    suspend fun extractCard(
        userInput: String,
        aiResponse: String,
        extractionPromptText: String
    ): CardPreview? {
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
                val prompt = CardExtractor.buildExtractionPrompt(
                    userInput, aiResponse, extractionPromptText
                )
                val response = extractionModel.generateContent(prompt)
                response.text?.let { CardExtractor.parseCardJson(it) }
            }
        } catch (e: Exception) {
            simpleExtraction // Return simple extraction if available, even if incomplete
        }
    }

    companion object {
        private const val MODEL_NAME = "gemini-2.5-flash"
        private const val STREAMING_TIMEOUT_MS = 60_000L
        private const val EXTRACTION_TIMEOUT_MS = 15_000L
    }
}
