package com.word2anki.data

import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import com.word2anki.data.models.Deck
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray

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

    /**
     * Get all available decks from AnkiDroid.
     */
    suspend fun getDecks(): List<Deck> = withContext(Dispatchers.IO) {
        if (!isAnkiDroidInstalled() || !hasAnkiPermission()) {
            return@withContext emptyList()
        }

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
     * Returns pairs of (modelId, modelName).
     */
    suspend fun getModels(): List<Pair<Long, String>> = withContext(Dispatchers.IO) {
        if (!isAnkiDroidInstalled() || !hasAnkiPermission()) {
            return@withContext emptyList()
        }

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
                val models = mutableListOf<Pair<Long, String>>()
                val idIndex = it.getColumnIndexOrThrow(FlashCardsContract.Model._ID)
                val nameIndex = it.getColumnIndexOrThrow(FlashCardsContract.Model.NAME)

                while (it.moveToNext()) {
                    models.add(
                        it.getLong(idIndex) to it.getString(nameIndex)
                    )
                }
                models
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load models", e)
            emptyList()
        }
    }

    /**
     * Get field names for a specific model.
     */
    suspend fun getModelFieldNames(modelId: Long): List<String> = withContext(Dispatchers.IO) {
        if (!isAnkiDroidInstalled() || !hasAnkiPermission()) {
            return@withContext emptyList()
        }

        try {
            val cursor = contentResolver.query(
                FlashCardsContract.Model.CONTENT_URI,
                arrayOf(FlashCardsContract.Model.FIELD_NAMES),
                "${FlashCardsContract.Model._ID} = ?",
                arrayOf(modelId.toString()),
                null
            ) ?: return@withContext emptyList()

            cursor.use {
                if (it.moveToFirst()) {
                    val fieldNamesIndex = it.getColumnIndexOrThrow(FlashCardsContract.Model.FIELD_NAMES)
                    val fieldNames = it.getString(fieldNamesIndex)
                    // Field names are stored as JSON array string like ["Front", "Back"]
                    val jsonArray = JSONArray(fieldNames)
                    (0 until jsonArray.length()).map { i -> jsonArray.getString(i) }
                } else {
                    emptyList()
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get model field names for model $modelId", e)
            emptyList()
        }
    }

    /**
     * Check if a note with the given word already exists in the specified deck.
     * Uses Anki's browser search syntax.
     */
    suspend fun noteExists(word: String, deckName: String): Boolean = withContext(Dispatchers.IO) {
        if (!isAnkiDroidInstalled() || !hasAnkiPermission()) {
            return@withContext false
        }

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
        if (!isAnkiDroidInstalled() || !hasAnkiPermission()) {
            return@withContext null
        }

        try {
            val values = ContentValues().apply {
                put(FlashCardsContract.Note.MID, modelId)
                put("deckId", deckId)
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
        models.find { it.second.equals("Basic", ignoreCase = true) }?.first
            ?: models.firstOrNull()?.first
    }

    /**
     * Find a note model by name.
     * @return The model ID if found, null otherwise.
     */
    suspend fun findModelByName(name: String): Long? = withContext(Dispatchers.IO) {
        val models = getModels()
        models.find { it.second == name }?.first
    }

    /**
     * Create a new note model in AnkiDroid.
     * @return The model ID if created, null otherwise.
     */
    suspend fun createModel(
        name: String,
        fields: List<String>,
        frontTemplate: String,
        backTemplate: String
    ): Long? = withContext(Dispatchers.IO) {
        if (!isAnkiDroidInstalled() || !hasAnkiPermission()) {
            return@withContext null
        }

        try {
            val values = ContentValues().apply {
                put(FlashCardsContract.Model.NAME, name)
                put(FlashCardsContract.Model.FIELD_NAMES,
                    fields.joinToString(",") { "\"$it\"" }.let { "[$it]" })
                put(FlashCardsContract.Model.NUM_CARDS, 1)
                put("cardNames", "[\"Card 1\"]")
                put("qfmt", "[\"$frontTemplate\"]")
                put("afmt", "[\"$backTemplate\"]")
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

    companion object {
        const val WORD2ANKI_MODEL_NAME = "word2anki"
        val WORD2ANKI_FIELDS = listOf("English", "Bangla", "ExampleSentence", "SentenceTranslation")
    }
}
