package com.word2anki.ai

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content
import com.google.ai.client.generativeai.type.generationConfig
import com.word2anki.data.models.CardPreview
import com.word2anki.data.models.Message
import com.word2anki.data.models.MessageRole
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Service for interacting with Google's Gemini API.
 */
class GeminiService(private val apiKey: String) {

    private val model: GenerativeModel by lazy {
        GenerativeModel(
            modelName = "gemini-2.5-flash",
            apiKey = apiKey,
            generationConfig = generationConfig {
                temperature = 0.7f
                maxOutputTokens = 1024
            },
            systemInstruction = content { text(PromptTemplates.getUnifiedSystemPrompt()) }
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
     */
    fun generateStreamingResponse(input: String, history: List<Message> = emptyList()): Flow<String> {
        return flow {
            if (history.isEmpty()) {
                // First message: add type hint and use simple generation
                val typeHint = PromptTemplates.getTypeHint(input)
                val chat = model.startChat()
                chat.sendMessageStream("$typeHint$input").collect { response ->
                    response.text?.let { emit(it) }
                }
            } else {
                // Multi-turn: build history and send via chat
                val chatHistory = history.map { msg ->
                    content(role = if (msg.role == MessageRole.USER) "user" else "model") {
                        text(msg.content)
                    }
                }
                val chat = model.startChat(chatHistory)
                chat.sendMessageStream(input).collect { response ->
                    response.text?.let { emit(it) }
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

        // Fall back to AI extraction
        return try {
            val extractionPrompt = CardExtractor.buildExtractionPrompt(userInput, aiResponse)
            val response = extractionModel.generateContent(extractionPrompt)
            response.text?.let { CardExtractor.parseCardJson(it) }
        } catch (e: Exception) {
            simpleExtraction // Return simple extraction if available, even if incomplete
        }
    }

    companion object {
        /**
         * Validate if an API key appears to be valid format.
         * Does not make an API call.
         */
        fun isValidApiKeyFormat(apiKey: String): Boolean {
            return apiKey.isNotBlank() && apiKey.length >= 20
        }
    }
}
