package com.word2anki.data

import android.net.Uri

/**
 * Contract for AnkiDroid ContentProvider API.
 * Based on AnkiDroid's FlashCardsContract.
 */
object FlashCardsContract {
    const val AUTHORITY = "com.ichi2.anki.flashcards"

    const val READ_WRITE_PERMISSION = "com.ichi2.anki.permission.READ_WRITE_DATABASE"

    object Note {
        val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY/notes")
        const val _ID = "_id"
        const val MID = "mid"           // Model ID
        const val DECK_ID = "deckId"
        const val FLDS = "flds"         // Fields (separated by \u001f)
        const val TAGS = "tags"
        const val SFLD = "sfld"         // Sort field
    }

    object Deck {
        val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY/decks")
        const val DECK_NAME = "deck_name"
        const val DECK_ID = "deck_id"
        const val DECK_COUNTS = "deck_counts"
    }

    object Model {
        val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY/models")
        const val _ID = "_id"
        const val NAME = "name"
        const val FIELD_NAMES = "field_names"
        const val NUM_CARDS = "num_cards"
        const val CARD_NAMES = "cardNames"
        const val QFMT = "qfmt"         // Question format (front template)
        const val AFMT = "afmt"         // Answer format (back template)
    }

    /**
     * Field separator used in FLDS column.
     * Fields are separated by Unit Separator character (ASCII 31).
     */
    const val FIELD_SEPARATOR = '\u001f'
}
