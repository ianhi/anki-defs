package com.word2anki.data

import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import com.word2anki.data.models.Deck
import com.word2anki.data.models.NoteModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val TAG = "AnkiRepository"

/**
 * Repository for interacting with AnkiDroid via ContentProvider API.
 */
class AnkiRepository(private val context: Context) {
    private val contentResolver = context.contentResolver

    /**
     * Check if AnkiDroid is installed on the device.
     */
    fun isAnkiDroidInstalled(): Boolean {
        return try {
            context.packageManager.resolveContentProvider(
                FlashCardsContract.AUTHORITY, 0
            ) != null
        } catch (e: Exception) {
            Log.w(TAG, "Error checking AnkiDroid installation", e)
            false
        }
    }

    /**
     * Check if we have permission to access AnkiDroid database.
     */
    fun hasAnkiPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            context.checkSelfPermission(FlashCardsContract.READ_WRITE_PERMISSION) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private val isAvailable: Boolean
        get() = isAnkiDroidInstalled() && hasAnkiPermission()

    /**
     * Get all available decks from AnkiDroid.
     */
    suspend fun getDecks(): List<Deck> = withContext(Dispatchers.IO) {
        if (!isAvailable) return@withContext emptyList()

        try {
            val cursor = contentResolver.query(
                FlashCardsContract.Deck.CONTENT_URI,
                arrayOf(
                    FlashCardsContract.Deck.DECK_ID,
                    FlashCardsContract.Deck.DECK_NAME
                ),
                null, null, null
            ) ?: return@withContext emptyList()

            cursor.use {
                val decks = mutableListOf<Deck>()
                val idIndex = it.getColumnIndexOrThrow(FlashCardsContract.Deck.DECK_ID)
                val nameIndex = it.getColumnIndexOrThrow(FlashCardsContract.Deck.DECK_NAME)

                while (it.moveToNext()) {
                    decks.add(
                        Deck(
                            id = it.getLong(idIndex),
                            name = it.getString(nameIndex)
                        )
                    )
                }
                decks.sortedBy { deck -> deck.name }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load decks", e)
            emptyList()
        }
    }

    /**
     * Get available note models from AnkiDroid.
     */
    suspend fun getModels(): List<NoteModel> = withContext(Dispatchers.IO) {
        if (!isAvailable) return@withContext emptyList()

        try {
            val cursor = contentResolver.query(
                FlashCardsContract.Model.CONTENT_URI,
                arrayOf(
                    FlashCardsContract.Model._ID,
                    FlashCardsContract.Model.NAME
                ),
                null, null, null
            ) ?: return@withContext emptyList()

            cursor.use {
                val models = mutableListOf<NoteModel>()
                val idIndex = it.getColumnIndexOrThrow(FlashCardsContract.Model._ID)
                val nameIndex = it.getColumnIndexOrThrow(FlashCardsContract.Model.NAME)

                while (it.moveToNext()) {
                    models.add(NoteModel(it.getLong(idIndex), it.getString(nameIndex)))
                }
                models
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load models", e)
            emptyList()
        }
    }

    /**
     * Check if a note with the given word already exists in the specified deck.
     * Uses Anki's browser search syntax.
     */
    suspend fun noteExists(word: String, deckName: String): Boolean = withContext(Dispatchers.IO) {
        if (!isAvailable) return@withContext false

        try {
            // Use Anki browser search syntax to find notes.
            // Escape quotes and backslashes to prevent query injection.
            val safeDeckName = deckName.replace("\\", "\\\\").replace("\"", "\\\"")
            val safeWord = word.replace("\\", "\\\\").replace("\"", "\\\"")
            val searchQuery = "deck:\"$safeDeckName\" \"$safeWord\""
            val cursor = contentResolver.query(
                FlashCardsContract.Note.CONTENT_URI,
                arrayOf(FlashCardsContract.Note._ID),
                searchQuery,
                null,
                null
            )
            cursor?.use { it.count > 0 } ?: false
        } catch (e: Exception) {
            Log.w(TAG, "Failed to check note existence for '$word'", e)
            false
        }
    }

    /**
     * Add a new note to AnkiDroid.
     *
     * @param modelId The ID of the note model/type to use
     * @param deckId The ID of the deck to add the note to
     * @param fields List of field values (order must match model's field order)
     * @param tags Optional tags for the note
     * @return The ID of the created note, or null if creation failed
     */
    suspend fun addNote(
        modelId: Long,
        deckId: Long,
        fields: List<String>,
        tags: Set<String>? = null
    ): Long? = withContext(Dispatchers.IO) {
        if (!isAvailable) return@withContext null

        try {
            val values = ContentValues().apply {
                put(FlashCardsContract.Note.MID, modelId)
                put(FlashCardsContract.Note.DECK_ID, deckId)
                put(FlashCardsContract.Note.FLDS, fields.joinToString(FlashCardsContract.FIELD_SEPARATOR.toString()))
                tags?.let { put(FlashCardsContract.Note.TAGS, it.joinToString(" ")) }
            }

            val resultUri = contentResolver.insert(FlashCardsContract.Note.CONTENT_URI, values)
            resultUri?.lastPathSegment?.toLongOrNull()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to add note", e)
            null
        }
    }

    /**
     * Get the first available "Basic" model ID.
     * Falls back to any available model if Basic is not found.
     */
    suspend fun getBasicModelId(): Long? = withContext(Dispatchers.IO) {
        val models = getModels()
        // Try to find a "Basic" model first
        models.find { it.name.equals("Basic", ignoreCase = true) }?.id
            ?: models.firstOrNull()?.id
    }

    private suspend fun findModelByName(name: String): Long? = withContext(Dispatchers.IO) {
        val models = getModels()
        models.find { it.name == name }?.id
    }

    /**
     * Create a new note model in AnkiDroid.
     * @return The model ID if created, null otherwise.
     */
    private suspend fun createModel(
        name: String,
        fields: List<String>,
        frontTemplate: String,
        backTemplate: String
    ): Long? = withContext(Dispatchers.IO) {
        if (!isAvailable) return@withContext null

        try {
            val values = ContentValues().apply {
                put(FlashCardsContract.Model.NAME, name)
                put(FlashCardsContract.Model.FIELD_NAMES,
                    fields.joinToString(",") { "\"$it\"" }.let { "[$it]" })
                put(FlashCardsContract.Model.NUM_CARDS, 1)
                put(FlashCardsContract.Model.CARD_NAMES, "[\"Card 1\"]")
                put(FlashCardsContract.Model.QFMT, "[\"$frontTemplate\"]")
                put(FlashCardsContract.Model.AFMT, "[\"$backTemplate\"]")
            }

            val resultUri = contentResolver.insert(FlashCardsContract.Model.CONTENT_URI, values)
            resultUri?.lastPathSegment?.toLongOrNull()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create model '$name'", e)
            null
        }
    }

    /**
     * Find or create the word2anki 4-field note model.
     * Fields: English, Bangla, ExampleSentence, SentenceTranslation
     * @return The model ID, or null if creation is not supported.
     */
    suspend fun ensureWord2AnkiModel(): Long? {
        // Try to find existing model
        findModelByName(WORD2ANKI_MODEL_NAME)?.let { return it }

        // Try to create it
        return createModel(
            name = WORD2ANKI_MODEL_NAME,
            fields = WORD2ANKI_FIELDS,
            frontTemplate = "{{English}}",
            backTemplate = "{{Bangla}}<br><br><i>{{ExampleSentence}}</i><br>{{SentenceTranslation}}"
        )
    }

    /**
     * Get field names for a model by name.
     */
    suspend fun getModelFields(modelName: String): List<String> = withContext(Dispatchers.IO) {
        if (!isAvailable) return@withContext emptyList()

        try {
            val cursor = contentResolver.query(
                FlashCardsContract.Model.CONTENT_URI,
                arrayOf(
                    FlashCardsContract.Model.NAME,
                    FlashCardsContract.Model.FIELD_NAMES
                ),
                null, null, null
            ) ?: return@withContext emptyList()

            cursor.use {
                val nameIndex = it.getColumnIndexOrThrow(FlashCardsContract.Model.NAME)
                val fieldsIndex = it.getColumnIndexOrThrow(FlashCardsContract.Model.FIELD_NAMES)

                while (it.moveToNext()) {
                    if (it.getString(nameIndex) == modelName) {
                        val fieldsJson = it.getString(fieldsIndex) ?: return@withContext emptyList()
                        // field_names is a JSON array like ["Front","Back"]
                        return@withContext try {
                            val jsonArray = org.json.JSONArray(fieldsJson)
                            (0 until jsonArray.length()).map { i -> jsonArray.getString(i) }
                        } catch (e: Exception) {
                            emptyList()
                        }
                    }
                }
                emptyList()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get model fields for '$modelName'", e)
            emptyList()
        }
    }

    /**
     * Search notes by query string (Anki browser search syntax).
     */
    suspend fun searchNotes(query: String): List<Map<String, Any?>> = withContext(Dispatchers.IO) {
        if (!isAvailable) return@withContext emptyList()

        try {
            val cursor = contentResolver.query(
                FlashCardsContract.Note.CONTENT_URI,
                arrayOf(
                    FlashCardsContract.Note._ID,
                    FlashCardsContract.Note.MID,
                    FlashCardsContract.Note.FLDS,
                    FlashCardsContract.Note.TAGS
                ),
                query,
                null,
                null
            ) ?: return@withContext emptyList()

            cursor.use {
                val notes = mutableListOf<Map<String, Any?>>()
                val idIndex = it.getColumnIndexOrThrow(FlashCardsContract.Note._ID)
                val midIndex = it.getColumnIndexOrThrow(FlashCardsContract.Note.MID)
                val fldsIndex = it.getColumnIndexOrThrow(FlashCardsContract.Note.FLDS)
                val tagsIndex = it.getColumnIndexOrThrow(FlashCardsContract.Note.TAGS)

                while (it.moveToNext()) {
                    val noteId = it.getLong(idIndex)
                    val modelId = it.getLong(midIndex)
                    val fields = it.getString(fldsIndex) ?: ""
                    val tags = it.getString(tagsIndex) ?: ""

                    notes.add(mapOf(
                        "noteId" to noteId,
                        "modelId" to modelId,
                        "fields" to fields.split(FlashCardsContract.FIELD_SEPARATOR),
                        "tags" to tags.trim().split(" ").filter { t -> t.isNotEmpty() }
                    ))
                }
                notes
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to search notes", e)
            emptyList()
        }
    }

    /**
     * Get a single note by ID.
     */
    suspend fun getNote(noteId: Long): Map<String, Any?>? = withContext(Dispatchers.IO) {
        if (!isAvailable) return@withContext null

        try {
            val noteUri = android.net.Uri.withAppendedPath(
                FlashCardsContract.Note.CONTENT_URI, noteId.toString()
            )
            val cursor = contentResolver.query(
                noteUri,
                arrayOf(
                    FlashCardsContract.Note._ID,
                    FlashCardsContract.Note.MID,
                    FlashCardsContract.Note.FLDS,
                    FlashCardsContract.Note.TAGS
                ),
                null, null, null
            ) ?: return@withContext null

            cursor.use {
                if (!it.moveToFirst()) return@withContext null

                val midIndex = it.getColumnIndexOrThrow(FlashCardsContract.Note.MID)
                val fldsIndex = it.getColumnIndexOrThrow(FlashCardsContract.Note.FLDS)
                val tagsIndex = it.getColumnIndexOrThrow(FlashCardsContract.Note.TAGS)

                val modelId = it.getLong(midIndex)
                val fields = it.getString(fldsIndex) ?: ""
                val tags = it.getString(tagsIndex) ?: ""

                mapOf(
                    "noteId" to noteId,
                    "modelId" to modelId,
                    "fields" to fields.split(FlashCardsContract.FIELD_SEPARATOR),
                    "tags" to tags.trim().split(" ").filter { t -> t.isNotEmpty() }
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get note $noteId", e)
            null
        }
    }

    /**
     * Delete a note by ID.
     */
    suspend fun deleteNote(noteId: Long): Boolean = withContext(Dispatchers.IO) {
        if (!isAvailable) return@withContext false

        try {
            val noteUri = android.net.Uri.withAppendedPath(
                FlashCardsContract.Note.CONTENT_URI, noteId.toString()
            )
            val deleted = contentResolver.delete(noteUri, null, null)
            deleted > 0
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete note $noteId", e)
            false
        }
    }

    /**
     * Find a deck ID by name.
     */
    suspend fun findDeckByName(name: String): Long? = withContext(Dispatchers.IO) {
        val decks = getDecks()
        decks.find { it.name == name }?.id
    }

    companion object {
        const val WORD2ANKI_MODEL_NAME = "word2anki"
        val WORD2ANKI_FIELDS = listOf("English", "Bangla", "ExampleSentence", "SentenceTranslation")
    }
}
