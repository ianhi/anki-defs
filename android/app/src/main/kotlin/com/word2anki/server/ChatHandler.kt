package com.word2anki.server

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.word2anki.ai.GeminiService
import com.word2anki.ai.SharedPromptLoader
import com.word2anki.data.AnkiRepository
import com.word2anki.data.models.CardPreview
import com.word2anki.server.LocalServer.Companion.jsonResponse
import com.word2anki.server.LocalServer.Companion.parseBody
import fi.iki.elonen.NanoHTTPD
import fi.iki.elonen.NanoHTTPD.Response
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.io.PipedInputStream
import java.io.PipedOutputStream

private const val TAG = "ChatHandler"

class ChatHandler(
    private val ankiRepository: AnkiRepository,
    private val geminiServiceProvider: () -> GeminiService?,
    private val promptLoader: SharedPromptLoader
) {
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun handle(session: NanoHTTPD.IHTTPSession, path: String): Response {
        if (session.method != NanoHTTPD.Method.POST) {
            return jsonResponse(Response.Status.METHOD_NOT_ALLOWED, """{"error":"method not allowed"}""")
        }

        return when (path) {
            "/stream" -> handleStream(session)
            "/relemmatize" -> handleRelemmatize(session)
            else -> jsonResponse(Response.Status.NOT_FOUND, """{"error":"not found"}""")
        }
    }

    private fun handleStream(session: NanoHTTPD.IHTTPSession): Response {
        val body = parseBody(session)
        val json = gson.fromJson(body, JsonObject::class.java)
        val newMessage = json.get("newMessage")?.asString
            ?: return jsonResponse(Response.Status.BAD_REQUEST, """{"error":"newMessage is required"}""")
        val deck = json.get("deck")?.asString
        val userContext = json.get("userContext")?.asString

        // Parse highlightedWords array from request
        val highlightedWords = json.getAsJsonArray("highlightedWords")
            ?.map { it.asString }
            ?: emptyList()

        val geminiService = geminiServiceProvider()
            ?: return jsonResponse(Response.Status.SERVICE_UNAVAILABLE, """{"error":"AI service not configured. Set Gemini API key in settings."}""")

        // Classify input
        val trimmedMessage = newMessage.trim()
        val isSingleWord = !trimmedMessage.contains(' ') && trimmedMessage.length < 30
        val hasHighlightedWords = highlightedWords.isNotEmpty()

        // Block sentence without highlights
        if (!isSingleWord && !hasHighlightedWords) {
            return sseResponse { output ->
                sendSSE(output, "error", gson.toJson("Sentence mode without highlighted words is not supported. Please highlight the words you want to learn."))
                sendSSE(output, "done", "null")
            }
        }

        // Select prompt and build user message
        val prompts = promptLoader.getSystemPrompts(transliteration = true)
        val systemPrompt: String
        val userMessage: String

        if (hasHighlightedWords) {
            systemPrompt = prompts.focusedWords
            userMessage = promptLoader.getFocusedWordsUserTemplate(
                newMessage,
                highlightedWords.joinToString(", ")
            )
            Log.d(TAG, "Using focused words prompt for: $highlightedWords")
        } else {
            systemPrompt = prompts.word
            userMessage = promptLoader.getWordUserTemplate(newMessage, userContext)
        }

        // Pre-check Anki for input words
        val wordsToCheck = if (hasHighlightedWords) highlightedWords else listOf(newMessage)

        return sseResponse { output ->
            try {
                // Check Anki for existing cards
                val ankiResults = mutableMapOf<String, Boolean>()
                for (word in wordsToCheck) {
                    try {
                        if (deck != null) {
                            ankiResults[word] = ankiRepository.noteExists(word, deck)
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Anki search failed for '$word'", e)
                    }
                }

                // Single non-streaming AI call
                val (rawResponse, usage) = geminiService.getJsonCompletion(systemPrompt, userMessage)

                // Send usage event
                if (usage != null) {
                    sendSSE(output, "usage", gson.toJson(usage))
                }

                // Parse JSON response with fault tolerance
                val cards = try {
                    parseCardResponses(rawResponse)
                } catch (e: Exception) {
                    Log.w(TAG, "JSON parse failed, retrying with healing prompt", e)
                    try {
                        val (retryResponse, retryUsage) = geminiService.getJsonCompletion(
                            "Fix the following malformed JSON. Return ONLY valid JSON, nothing else.",
                            rawResponse
                        )
                        if (retryUsage != null) {
                            sendSSE(output, "usage", gson.toJson(retryUsage))
                        }
                        parseCardResponses(retryResponse)
                    } catch (e2: Exception) {
                        Log.e(TAG, "JSON parse failed after retry", e2)
                        sendSSE(output, "error", gson.toJson("Failed to parse AI response as JSON"))
                        sendSSE(output, "done", "null")
                        return@sseResponse
                    }
                }

                // Build card previews with Anki duplicate checks
                val cardPreviews = buildCardPreviews(cards, deck, ankiResults)

                for (preview in cardPreviews) {
                    val cardData = mutableMapOf<String, Any?>(
                        "word" to preview.word,
                        "definition" to preview.definition,
                        "banglaDefinition" to preview.banglaDefinition,
                        "exampleSentence" to preview.exampleSentence,
                        "sentenceTranslation" to preview.sentenceTranslation,
                        "spellingCorrection" to preview.spellingCorrection,
                        "alreadyExists" to preview.alreadyExists
                    )
                    if (preview.existingCard != null) {
                        cardData["existingCard"] = preview.existingCard
                    }
                    sendSSE(output, "card_preview", gson.toJson(cardData))
                }

                sendSSE(output, "done", "null")
            } catch (e: Exception) {
                Log.e(TAG, "Stream error", e)
                try {
                    sendSSE(output, "error", gson.toJson(e.message ?: "Unknown error"))
                    sendSSE(output, "done", "null")
                } catch (_: Exception) {}
            }
        }
    }

    /**
     * Parse JSON response from AI, stripping code fences if present.
     * Returns a list of card response objects.
     */
    private fun parseCardResponses(raw: String): List<JsonObject> {
        val stripped = raw
            .replace(Regex("^```(?:json)?\\s*\\n?", RegexOption.MULTILINE), "")
            .replace(Regex("\\n?```\\s*$", RegexOption.MULTILINE), "")
            .trim()

        val parsed = JsonParser.parseString(stripped)
        return if (parsed.isJsonArray) {
            parsed.asJsonArray.map { it.asJsonObject }
        } else {
            listOf(parsed.asJsonObject)
        }
    }

    /**
     * Apply spelling correction to example sentence if present.
     */
    private fun applySpellingCorrection(sentence: String, correction: String): String {
        val match = Regex("^(.+?)\\s*→\\s*(.+)$").find(correction) ?: return sentence
        val (wrong, right) = match.destructured
        return sentence
            .replace(wrong, right)
            .replace("**$wrong**", "**$right**")
    }

    /**
     * Build CardPreviews from parsed AI card responses + Anki duplicate check results.
     */
    private suspend fun buildCardPreviews(
        cards: List<JsonObject>,
        deck: String?,
        ankiResults: MutableMap<String, Boolean>
    ): List<CardPreview> {
        return cards.map { card ->
            val word = card.get("word")?.asString ?: ""
            val spellingCorrection = card.get("spellingCorrection")?.let {
                if (it.isJsonNull) null else it.asString
            }

            // Check Anki for the lemmatized word (may differ from input word)
            val alreadyExists = if (deck != null && !ankiResults.containsKey(word)) {
                try {
                    val exists = ankiRepository.noteExists(word, deck)
                    ankiResults[word] = exists
                    exists
                } catch (e: Exception) {
                    Log.w(TAG, "Anki search failed for '$word'", e)
                    false
                }
            } else {
                ankiResults[word] ?: false
            }

            val rawExample = card.get("exampleSentence")?.asString ?: ""
            val exampleSentence = if (spellingCorrection != null) {
                applySpellingCorrection(rawExample, spellingCorrection)
            } else {
                rawExample
            }

            CardPreview(
                word = word,
                definition = card.get("definition")?.asString ?: "",
                banglaDefinition = card.get("banglaDefinition")?.asString ?: "",
                exampleSentence = exampleSentence,
                sentenceTranslation = card.get("sentenceTranslation")?.asString ?: "",
                spellingCorrection = spellingCorrection,
                alreadyExists = alreadyExists
            )
        }
    }

    private fun handleRelemmatize(session: NanoHTTPD.IHTTPSession): Response {
        val body = parseBody(session)
        val json = gson.fromJson(body, JsonObject::class.java)
        val word = json.get("word")?.asString
            ?: return jsonResponse(Response.Status.BAD_REQUEST, """{"error":"word is required"}""")
        val sentence = json.get("sentence")?.asString

        val geminiService = geminiServiceProvider()
            ?: return jsonResponse(Response.Status.SERVICE_UNAVAILABLE, """{"error":"AI service not configured"}""")

        return runBlocking {
            try {
                val systemPrompt = promptLoader.getRelemmatizePrompt(word, sentence)

                val responseText = geminiService.getCompletion(systemPrompt, word)

                val result = try {
                    val parsed = gson.fromJson(responseText
                        .replace("```json", "").replace("```", "").trim(), JsonObject::class.java)
                    gson.toJson(mapOf(
                        "lemma" to (parsed.get("lemma")?.asString ?: word),
                        "definition" to (parsed.get("definition")?.asString ?: "")
                    ))
                } catch (e: Exception) {
                    gson.toJson(mapOf("lemma" to word, "definition" to ""))
                }

                jsonResponse(Response.Status.OK, result)
            } catch (e: Exception) {
                Log.e(TAG, "Error relemmatizing word", e)
                jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to relemmatize word"}""")
            }
        }
    }

    /**
     * Helper to send a single SSE event.
     */
    private fun sendSSE(output: PipedOutputStream, type: String, data: String) {
        val event = """{"type":"$type","data":$data}"""
        Log.d(TAG, "SSE: $type ${data.take(60)}...")
        output.write("data: $event\n\n".toByteArray())
        output.flush()
    }

    /**
     * Create an SSE response using PipedInputStream/PipedOutputStream pattern.
     */
    private fun sseResponse(block: suspend (PipedOutputStream) -> Unit): Response {
        val pipedInput = PipedInputStream()
        val pipedOutput = PipedOutputStream(pipedInput)

        scope.launch {
            try {
                block(pipedOutput)
            } finally {
                try { pipedOutput.close() } catch (_: Exception) {}
            }
        }

        val response = NanoHTTPD.newChunkedResponse(Response.Status.OK, "text/event-stream", pipedInput)
        response.addHeader("Cache-Control", "no-cache")
        response.addHeader("Connection", "keep-alive")
        return response
    }
}
