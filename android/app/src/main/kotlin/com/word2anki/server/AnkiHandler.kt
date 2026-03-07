package com.word2anki.server

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.word2anki.data.AnkiRepository
import com.word2anki.server.LocalServer.Companion.jsonResponse
import com.word2anki.server.LocalServer.Companion.parseBody
import fi.iki.elonen.NanoHTTPD
import fi.iki.elonen.NanoHTTPD.Response
import kotlinx.coroutines.runBlocking

private const val TAG = "AnkiHandler"

class AnkiHandler(private val ankiRepository: AnkiRepository) {
    private val gson = Gson()

    fun handle(session: NanoHTTPD.IHTTPSession, path: String): Response {
        return when {
            path == "/decks" && session.method == NanoHTTPD.Method.GET -> handleGetDecks()
            path == "/models" && session.method == NanoHTTPD.Method.GET -> handleGetModels()
            path.matches(Regex("/models/.+/fields")) && session.method == NanoHTTPD.Method.GET -> {
                val modelName = path.removePrefix("/models/").removeSuffix("/fields")
                handleGetModelFields(java.net.URLDecoder.decode(modelName, "UTF-8"))
            }
            path == "/search" && session.method == NanoHTTPD.Method.POST -> handleSearch(session)
            path == "/notes" && session.method == NanoHTTPD.Method.POST -> handleCreateNote(session)
            path.matches(Regex("/notes/\\d+")) && session.method == NanoHTTPD.Method.GET -> {
                val noteId = path.removePrefix("/notes/").toLong()
                handleGetNote(noteId)
            }
            path.matches(Regex("/notes/\\d+")) && session.method == NanoHTTPD.Method.DELETE -> {
                val noteId = path.removePrefix("/notes/").toLong()
                handleDeleteNote(noteId)
            }
            path == "/status" && session.method == NanoHTTPD.Method.GET -> handleStatus()
            else -> jsonResponse(Response.Status.NOT_FOUND, """{"error":"not found"}""")
        }
    }

    private fun handleGetDecks(): Response = runBlocking {
        try {
            val decks = ankiRepository.getDecks()
            val deckNames = decks.map { it.name }
            jsonResponse(Response.Status.OK, gson.toJson(mapOf("decks" to deckNames)))
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching decks", e)
            jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to fetch decks"}""")
        }
    }

    private fun handleGetModels(): Response = runBlocking {
        try {
            val models = ankiRepository.getModels()
            val modelNames = models.map { it.name }
            jsonResponse(Response.Status.OK, gson.toJson(mapOf("models" to modelNames)))
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching models", e)
            jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to fetch models"}""")
        }
    }

    private fun handleGetModelFields(modelName: String): Response = runBlocking {
        try {
            val fields = ankiRepository.getModelFields(modelName)
            jsonResponse(Response.Status.OK, gson.toJson(mapOf("fields" to fields)))
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching model fields", e)
            jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to fetch model fields"}""")
        }
    }

    private fun handleSearch(session: NanoHTTPD.IHTTPSession): Response {
        val body = parseBody(session)
        val json = gson.fromJson(body, JsonObject::class.java)
        val query = json.get("query")?.asString
            ?: return jsonResponse(Response.Status.BAD_REQUEST, """{"error":"Query is required"}""")

        return runBlocking {
            try {
                val notes = ankiRepository.searchNotes(query)
                // Convert to API format with field names from model
                val formattedNotes = notes.map { note ->
                    val modelId = note["modelId"] as Long
                    val fieldValues = (note["fields"] as List<*>).map { it.toString() }
                    val tags = note["tags"] as List<*>

                    // Look up model name and field names
                    val models = ankiRepository.getModels()
                    val model = models.find { it.id == modelId }
                    val modelName = model?.name ?: "Unknown"
                    val fieldNames = if (model != null) {
                        ankiRepository.getModelFields(modelName)
                    } else emptyList()

                    val fieldsMap = mutableMapOf<String, Map<String, Any>>()
                    fieldNames.forEachIndexed { index, name ->
                        val value = fieldValues.getOrElse(index) { "" }
                        fieldsMap[name] = mapOf("value" to value, "order" to index)
                    }

                    mapOf(
                        "noteId" to note["noteId"],
                        "modelName" to modelName,
                        "tags" to tags,
                        "fields" to fieldsMap
                    )
                }
                jsonResponse(Response.Status.OK, gson.toJson(mapOf("notes" to formattedNotes)))
            } catch (e: Exception) {
                Log.e(TAG, "Error searching notes", e)
                jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to search notes"}""")
            }
        }
    }

    private fun handleCreateNote(session: NanoHTTPD.IHTTPSession): Response {
        val body = parseBody(session)
        val json = gson.fromJson(body, JsonObject::class.java)

        val deckName = json.get("deckName")?.asString
        val modelName = json.get("modelName")?.asString
        val fieldsObj = json.getAsJsonObject("fields")

        if (deckName == null || modelName == null || fieldsObj == null) {
            return jsonResponse(Response.Status.BAD_REQUEST, """{"error":"deckName, modelName, and fields are required"}""")
        }

        val tags = json.getAsJsonArray("tags")?.map { it.asString }?.toSet()

        return runBlocking {
            try {
                // Find deck and model IDs
                val deckId = ankiRepository.findDeckByName(deckName)
                    ?: return@runBlocking jsonResponse(Response.Status.NOT_FOUND, """{"error":"Deck not found: $deckName"}""")

                val models = ankiRepository.getModels()
                val model = models.find { it.name == modelName }
                    ?: return@runBlocking jsonResponse(Response.Status.NOT_FOUND, """{"error":"Model not found: $modelName"}""")

                // Get field order from model
                val fieldNames = ankiRepository.getModelFields(modelName)
                val fieldValues = fieldNames.map { name ->
                    fieldsObj.get(name)?.asString ?: ""
                }

                val noteId = ankiRepository.addNote(model.id, deckId, fieldValues, tags)
                if (noteId != null) {
                    jsonResponse(Response.Status.OK, """{"noteId":$noteId}""")
                } else {
                    jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to create note"}""")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error creating note", e)
                jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to create note"}""")
            }
        }
    }

    private fun handleGetNote(noteId: Long): Response = runBlocking {
        try {
            val note = ankiRepository.getNote(noteId)
                ?: return@runBlocking jsonResponse(Response.Status.NOT_FOUND, """{"error":"Note not found"}""")

            val modelId = note["modelId"] as Long
            val fieldValues = (note["fields"] as List<*>).map { it.toString() }
            val tags = note["tags"] as List<*>

            val models = ankiRepository.getModels()
            val model = models.find { it.id == modelId }
            val modelName = model?.name ?: "Unknown"
            val fieldNames = if (model != null) {
                ankiRepository.getModelFields(modelName)
            } else emptyList()

            val fieldsMap = mutableMapOf<String, Map<String, Any>>()
            fieldNames.forEachIndexed { index, name ->
                val value = fieldValues.getOrElse(index) { "" }
                fieldsMap[name] = mapOf("value" to value, "order" to index)
            }

            val formatted = mapOf(
                "noteId" to noteId,
                "modelName" to modelName,
                "tags" to tags,
                "fields" to fieldsMap
            )

            jsonResponse(Response.Status.OK, gson.toJson(mapOf("note" to formatted)))
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching note", e)
            jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to fetch note"}""")
        }
    }

    private fun handleDeleteNote(noteId: Long): Response = runBlocking {
        try {
            val success = ankiRepository.deleteNote(noteId)
            if (success) {
                jsonResponse(Response.Status.OK, """{"success":true}""")
            } else {
                jsonResponse(Response.Status.NOT_FOUND, """{"error":"Note not found or could not be deleted"}""")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error deleting note", e)
            jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Failed to delete note"}""")
        }
    }

    private fun handleStatus(): Response {
        val installed = ankiRepository.isAnkiDroidInstalled()
        val hasPermission = ankiRepository.hasAnkiPermission()
        return jsonResponse(Response.Status.OK, gson.toJson(mapOf("connected" to (installed && hasPermission))))
    }
}
