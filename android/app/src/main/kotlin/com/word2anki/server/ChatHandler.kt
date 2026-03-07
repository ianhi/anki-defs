package com.word2anki.server

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.word2anki.ai.CardExtractor
import com.word2anki.ai.GeminiService
import com.word2anki.ai.PromptTemplates
import com.word2anki.data.AnkiRepository
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
    private val geminiServiceProvider: () -> GeminiService?
) {
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun handle(session: NanoHTTPD.IHTTPSession, path: String): Response {
        if (session.method != NanoHTTPD.Method.POST) {
            return jsonResponse(Response.Status.METHOD_NOT_ALLOWED, """{"error":"method not allowed"}""")
        }

        return when (path) {
            "/stream" -> handleStream(session)
            "/define" -> handleDefine(session)
            "/relemmatize" -> handleRelemmatize(session)
            "/analyze" -> handleAnalyze(session)
            else -> jsonResponse(Response.Status.NOT_FOUND, """{"error":"not found"}""")
        }
    }

    private fun handleStream(session: NanoHTTPD.IHTTPSession): Response {
        val body = parseBody(session)
        val json = gson.fromJson(body, JsonObject::class.java)
        val newMessage = json.get("newMessage")?.asString
            ?: return jsonResponse(Response.Status.BAD_REQUEST, """{"error":"newMessage is required"}""")
        val deck = json.get("deck")?.asString

        val geminiService = geminiServiceProvider()
            ?: return jsonResponse(Response.Status.SERVICE_UNAVAILABLE, """{"error":"AI service not configured. Set Gemini API key in settings."}""")

        val pipedInput = PipedInputStream()
        val pipedOutput = PipedOutputStream(pipedInput)

        scope.launch {
            try {
                val fullResponse = StringBuilder()

                geminiService.generateStreamingResponse(newMessage).collect { chunk ->
                    fullResponse.append(chunk)
                    val event = gson.toJson(mapOf("type" to "text", "data" to chunk))
                    pipedOutput.write("data: $event\n\n".toByteArray())
                    pipedOutput.flush()
                }

                // Extract card preview from the response
                try {
                    val card = geminiService.extractCard(newMessage, fullResponse.toString())
                    if (card != null) {
                        val exists = if (deck != null) {
                            ankiRepository.noteExists(card.word, deck)
                        } else false

                        val cardData = mapOf(
                            "word" to card.word,
                            "definition" to card.definition,
                            "exampleSentence" to card.exampleSentence,
                            "sentenceTranslation" to card.sentenceTranslation,
                            "alreadyExists" to exists
                        )
                        val event = gson.toJson(mapOf("type" to "card_preview", "data" to cardData))
                        pipedOutput.write("data: $event\n\n".toByteArray())
                        pipedOutput.flush()
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Card extraction failed", e)
                }

                // Send done event
                val doneEvent = gson.toJson(mapOf("type" to "done", "data" to null))
                pipedOutput.write("data: $doneEvent\n\n".toByteArray())
                pipedOutput.flush()
            } catch (e: Exception) {
                Log.e(TAG, "Stream error", e)
                try {
                    val errorEvent = gson.toJson(mapOf("type" to "error", "data" to (e.message ?: "Unknown error")))
                    pipedOutput.write("data: $errorEvent\n\n".toByteArray())
                    pipedOutput.flush()
                } catch (_: Exception) {}
            } finally {
                try { pipedOutput.close() } catch (_: Exception) {}
            }
        }

        val response = NanoHTTPD.newChunkedResponse(Response.Status.OK, "text/event-stream", pipedInput)
        response.addHeader("Cache-Control", "no-cache")
        response.addHeader("Connection", "keep-alive")
        return response
    }

    private fun handleDefine(session: NanoHTTPD.IHTTPSession): Response {
        val body = parseBody(session)
        val json = gson.fromJson(body, JsonObject::class.java)
        val word = json.get("word")?.asString
            ?: return jsonResponse(Response.Status.BAD_REQUEST, """{"error":"word is required"}""")
        val deck = json.get("deck")?.asString

        val geminiService = geminiServiceProvider()
            ?: return jsonResponse(Response.Status.SERVICE_UNAVAILABLE, """{"error":"AI service not configured"}""")

        return runBlocking {
            try {
                var existsInAnki = false
                var noteId: Long? = null

                if (deck != null) {
                    try {
                        existsInAnki = ankiRepository.noteExists(word, deck)
                    } catch (e: Exception) {
                        Log.w(TAG, "Anki search failed", e)
                    }
                }

                val prompt = """Define this word concisely. Return ONLY valid JSON:
{
  "word": "$word",
  "lemma": "dictionary form",
  "partOfSpeech": "noun/verb/adj/etc",
  "definition": "concise English definition",
  "examples": ["example sentence 1", "example sentence 2"]
}"""

                val responseText = StringBuilder()
                geminiService.generateStreamingResponse(prompt).collect { chunk ->
                    responseText.append(chunk)
                }

                val result = try {
                    val parsed = gson.fromJson(responseText.toString()
                        .replace("```json", "").replace("```", "").trim(), JsonObject::class.java)
                    parsed.addProperty("existsInAnki", existsInAnki)
                    noteId?.let { parsed.addProperty("noteId", it) }
                    gson.toJson(parsed)
                } catch (e: Exception) {
                    gson.toJson(mapOf(
                        "word" to word,
                        "definition" to responseText.toString(),
                        "existsInAnki" to existsInAnki
                    ))
                }

                jsonResponse(Response.Status.OK, result)
            } catch (e: Exception) {
                Log.e(TAG, "Error defining word", e)
                jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to get definition"}""")
            }
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
                val context = if (sentence != null) "\nContext sentence: $sentence" else ""
                val prompt = """What is the correct Bangla dictionary/lemma form of "$word"?$context

Return ONLY valid JSON:
{
  "lemma": "the dictionary form (verbal noun for verbs, bare noun without case endings, etc.)",
  "definition": "concise English definition (under 10 words)"
}

Bangla Lemmatization Rules:
- Nouns: Remove case endings. বাজারে→বাজার, বাজারের→বাজার, বাজারকে→বাজার
- Verbs: Convert to verbal noun. কাঁদতে→কাঁদা, যাব→যাওয়া, খাচ্ছি→খাওয়া, করেছিল→করা, গেছে→যাওয়া
- Adjectives: Use base form. বড়ো→বড়"""

                val responseText = StringBuilder()
                geminiService.generateStreamingResponse(prompt).collect { chunk ->
                    responseText.append(chunk)
                }

                val result = try {
                    val parsed = gson.fromJson(responseText.toString()
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

    private fun handleAnalyze(session: NanoHTTPD.IHTTPSession): Response {
        val body = parseBody(session)
        val json = gson.fromJson(body, JsonObject::class.java)
        val sentence = json.get("sentence")?.asString
            ?: return jsonResponse(Response.Status.BAD_REQUEST, """{"error":"sentence is required"}""")
        val deck = json.get("deck")?.asString

        val geminiService = geminiServiceProvider()
            ?: return jsonResponse(Response.Status.SERVICE_UNAVAILABLE, """{"error":"AI service not configured"}""")

        return runBlocking {
            try {
                val prompt = """Analyze this sentence. Return ONLY valid JSON:
{
  "translation": "English translation",
  "words": [
    {"word": "original", "lemma": "dictionary form", "partOfSpeech": "noun/verb/etc", "meaning": "English meaning"}
  ]
}

Sentence: $sentence"""

                val responseText = StringBuilder()
                geminiService.generateStreamingResponse(prompt).collect { chunk ->
                    responseText.append(chunk)
                }

                val parsed = try {
                    gson.fromJson(responseText.toString()
                        .replace("```json", "").replace("```", "").trim(), JsonObject::class.java)
                } catch (e: Exception) {
                    val fallback = JsonObject()
                    fallback.addProperty("translation", responseText.toString())
                    fallback.add("words", com.google.gson.JsonArray())
                    fallback
                }

                // Enrich words with Anki status
                val wordsArray = parsed.getAsJsonArray("words")
                if (wordsArray != null && deck != null) {
                    for (element in wordsArray) {
                        val wordObj = element.asJsonObject
                        val lemma = wordObj.get("lemma")?.asString ?: continue
                        try {
                            val exists = ankiRepository.noteExists(lemma, deck)
                            wordObj.addProperty("existsInAnki", exists)
                        } catch (e: Exception) {
                            wordObj.addProperty("existsInAnki", false)
                        }
                    }
                }

                val result = JsonObject()
                result.addProperty("originalSentence", sentence)
                result.addProperty("translation", parsed.get("translation")?.asString ?: "")
                result.add("words", parsed.getAsJsonArray("words") ?: com.google.gson.JsonArray())

                jsonResponse(Response.Status.OK, gson.toJson(result))
            } catch (e: Exception) {
                Log.e(TAG, "Error analyzing sentence", e)
                jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to analyze sentence"}""")
            }
        }
    }
}
