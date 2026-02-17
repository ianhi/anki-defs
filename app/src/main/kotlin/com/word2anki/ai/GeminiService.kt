package com.word2anki.ai

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.GenerateContentResponse
import com.google.ai.client.generativeai.type.generationConfig
import com.word2anki.data.models.CardPreview
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map

/**
 * Service for interacting with Google's Gemini API.
 */
class GeminiService(private val apiKey: String) {

    private val model: GenerativeModel by lazy {
        GenerativeModel(
            modelName = "gemini-1.5-flash",
            apiKey = apiKey,
            generationConfig = generationConfig {
                temperature = 0.7f
                maxOutputTokens = 1024
            }
        )
    }

    private val extractionModel: GenerativeModel by lazy {
        GenerativeModel(
            modelName = "gemini-1.5-flash",
            apiKey = apiKey,
            generationConfig = generationConfig {
                temperature = 0.1f
                maxOutputTokens = 256
            }
        )
    }

    /**
     * Generate a streaming response for the given input.
     * Automatically selects the appropriate prompt type.
     */
    fun generateStreamingResponse(input: String): Flow<String> {
        val promptType = PromptTemplates.getPromptType(input)
        val systemPrompt = PromptTemplates.getSystemPrompt(promptType)
        val fullPrompt = "$systemPrompt\n\nUser: $input"

        return flow {
            model.generateContentStream(fullPrompt).collect { response ->
                response.text?.let { emit(it) }
            }
        }
    }

    /**
     * Generate a complete (non-streaming) response.
     */
    suspend fun generateResponse(input: String): String {
        val promptType = PromptTemplates.getPromptType(input)
        val systemPrompt = PromptTemplates.getSystemPrompt(promptType)
        val fullPrompt = "$systemPrompt\n\nUser: $input"

        return try {
            val response = model.generateContent(fullPrompt)
            response.text ?: "No response generated"
        } catch (e: Exception) {
            "Error: ${e.message ?: "Failed to generate response"}"
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
