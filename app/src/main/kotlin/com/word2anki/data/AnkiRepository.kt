package com.word2anki.data

import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import com.word2anki.data.models.Deck
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

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
                    fieldNames.removeSurrounding("[", "]")
                        .split(",")
                        .map { name -> name.trim().removeSurrounding("\"") }
                } else {
                    emptyList()
                }
            }
        } catch (e: Exception) {
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
            // Use Anki browser search syntax to find notes
            val searchQuery = "deck:\"$deckName\" \"$word\""
            val cursor = contentResolver.query(
                FlashCardsContract.Note.CONTENT_URI,
                arrayOf(FlashCardsContract.Note._ID),
                searchQuery,
                null,
                null
            )
            val exists = (cursor?.count ?: 0) > 0
            cursor?.close()
            exists
        } catch (e: Exception) {
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
                put(FlashCardsContract.Note.FLDS, fields.joinToString(FlashCardsContract.FIELD_SEPARATOR.toString()))
                tags?.let { put(FlashCardsContract.Note.TAGS, it.joinToString(" ")) }
            }

            // The deck is specified via URI path segment
            val deckUri = Uri.withAppendedPath(
                FlashCardsContract.Note.CONTENT_URI,
                deckId.toString()
            )

            val resultUri = contentResolver.insert(deckUri, values)
            resultUri?.lastPathSegment?.toLongOrNull()
        } catch (e: Exception) {
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
}
