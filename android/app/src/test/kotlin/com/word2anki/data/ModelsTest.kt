package com.word2anki.data

import com.word2anki.data.models.CardPreview
import com.word2anki.data.models.Deck
import com.word2anki.data.models.MessageRole
import com.word2anki.data.models.Settings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelsTest {

    // CardPreview Tests
    @Test
    fun `CardPreview alreadyExists is false by default`() {
        val card = CardPreview(
            word = "test",
            definition = "def",
            exampleSentence = "ex",
            sentenceTranslation = "trans"
        )
        assertFalse(card.alreadyExists)
    }

    @Test
    fun `CardPreview isAdded is false by default`() {
        val card = CardPreview(
            word = "test",
            definition = "def",
            exampleSentence = "ex",
            sentenceTranslation = "trans"
        )
        assertFalse(card.isAdded)
    }

    @Test
    fun `CardPreview copy updates alreadyExists`() {
        val card = CardPreview(
            word = "test",
            definition = "def",
            exampleSentence = "ex",
            sentenceTranslation = "trans"
        )
        val updated = card.copy(alreadyExists = true)
        assertTrue(updated.alreadyExists)
        assertFalse(card.alreadyExists)
    }

    @Test
    fun `CardPreview copy updates isAdded`() {
        val card = CardPreview(
            word = "test",
            definition = "def",
            exampleSentence = "ex",
            sentenceTranslation = "trans"
        )
        val added = card.copy(isAdded = true)
        assertTrue(added.isAdded)
        assertFalse(card.isAdded)
    }

    // Deck Tests
    @Test
    fun `Deck stores id and name`() {
        val deck = Deck(id = 123L, name = "My Deck")
        assertEquals(123L, deck.id)
        assertEquals("My Deck", deck.name)
    }

    @Test
    fun `Deck equality based on id and name`() {
        val deck1 = Deck(id = 1L, name = "Deck")
        val deck2 = Deck(id = 1L, name = "Deck")
        val deck3 = Deck(id = 2L, name = "Deck")
        assertEquals(deck1, deck2)
        assertNotEquals(deck1, deck3)
    }

    // Settings Tests
    @Test
    fun `Settings has empty defaults`() {
        val settings = Settings()
        assertEquals("", settings.geminiApiKey)
        assertEquals("", settings.defaultDeckName)
        assertEquals(0L, settings.defaultDeckId)
        assertEquals(0L, settings.defaultModelId)
    }

    @Test
    fun `Settings stores values correctly`() {
        val settings = Settings(
            geminiApiKey = "test-api-key",
            defaultDeckName = "My Deck",
            defaultDeckId = 123L,
            defaultModelId = 456L
        )
        assertEquals("test-api-key", settings.geminiApiKey)
        assertEquals("My Deck", settings.defaultDeckName)
        assertEquals(123L, settings.defaultDeckId)
        assertEquals(456L, settings.defaultModelId)
    }

    // MessageRole Tests
    @Test
    fun `MessageRole has USER and ASSISTANT values`() {
        assertEquals("USER", MessageRole.USER.name)
        assertEquals("ASSISTANT", MessageRole.ASSISTANT.name)
    }
}
