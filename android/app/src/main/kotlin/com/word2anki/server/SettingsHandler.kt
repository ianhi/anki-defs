package com.word2anki.server

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.word2anki.data.SettingsRepository
import com.word2anki.server.LocalServer.Companion.jsonResponse
import com.word2anki.server.LocalServer.Companion.parseBody
import fi.iki.elonen.NanoHTTPD
import fi.iki.elonen.NanoHTTPD.Response
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private const val TAG = "SettingsHandler"

class SettingsHandler(private val settingsRepository: SettingsRepository) {
    private val gson = Gson()

    fun handle(session: NanoHTTPD.IHTTPSession, method: NanoHTTPD.Method): Response {
        return when (method) {
            NanoHTTPD.Method.GET -> handleGet()
            NanoHTTPD.Method.PUT -> handlePut(session)
            else -> jsonResponse(Response.Status.METHOD_NOT_ALLOWED, """{"error":"method not allowed"}""")
        }
    }

    private fun handleGet(): Response = runBlocking {
        try {
            val settings = settingsRepository.settingsFlow.first()
            val maskedKey = if (settings.geminiApiKey.length > 4) {
                "••••••••" + settings.geminiApiKey.takeLast(4)
            } else ""

            val result = mapOf(
                "aiProvider" to "gemini",
                "claudeApiKey" to "",
                "geminiApiKey" to maskedKey,
                "geminiModel" to "gemini-2.5-flash",
                "openRouterApiKey" to "",
                "openRouterModel" to "",
                "showTransliteration" to false,
                "defaultDeck" to settings.defaultDeckName,
                "defaultModel" to "",
                "ankiConnectUrl" to ""
            )
            jsonResponse(Response.Status.OK, gson.toJson(result))
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching settings", e)
            jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to fetch settings"}""")
        }
    }

    private fun handlePut(session: NanoHTTPD.IHTTPSession): Response {
        val body = parseBody(session)
        val json = gson.fromJson(body, JsonObject::class.java)

        return runBlocking {
            try {
                // Update Gemini API key if provided and not masked
                json.get("geminiApiKey")?.asString?.let { key ->
                    if (!key.startsWith("••••")) {
                        settingsRepository.updateGeminiApiKey(key)
                    }
                }

                // Update default deck if provided
                json.get("defaultDeck")?.asString?.let { deckName ->
                    settingsRepository.updateDefaultDeck(0L, deckName)
                }

                // Return updated settings
                handleGet()
            } catch (e: Exception) {
                Log.e(TAG, "Error updating settings", e)
                jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to update settings"}""")
            }
        }
    }
}
