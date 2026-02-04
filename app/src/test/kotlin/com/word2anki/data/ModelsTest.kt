package com.word2anki.data

import com.word2anki.data.models.CardPreview
import com.word2anki.data.models.Deck
import com.word2anki.data.models.Message
import com.word2anki.data.models.MessageRole
import com.word2anki.data.models.Settings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelsTest {

    // Message Tests
    @Test
    fun `Message has unique ID by default`() {
        val message1 = Message(role = MessageRole.USER, content = "Hello")
        val message2 = Message(role = MessageRole.USER, content = "Hello")

        assertNotEquals(message1.id, message2.id)
    }

    @Test
    fun `Message has timestamp by default`() {
        val before = System.currentTimeMillis()
        val message = Message(role = MessageRole.USER, content = "Test")
        val after = System.currentTimeMillis()

        assertTrue(message.timestamp >= before)
        assertTrue(message.timestamp <= after)
    }

    @Test
    fun `Message cardPreview is null by default`() {
        val message = Message(role = MessageRole.USER, content = "Test")

        assertNull(message.cardPreview)
    }

    @Test
    fun `Message isStreaming is false by default`() {
        val message = Message(role = MessageRole.USER, content = "Test")

        assertFalse(message.isStreaming)
    }

    @Test
    fun `Message can have cardPreview`() {
        val cardPreview = CardPreview(
            word = "test",
            definition = "a definition",
            exampleSentence = "example",
            sentenceTranslation = "translation"
        )
        val message = Message(
            role = MessageRole.ASSISTANT,
            content = "Response",
            cardPreview = cardPreview
        )

        assertNotNull(message.cardPreview)
        assertEquals("test", message.cardPreview?.word)
    }

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

        val updatedCard = card.copy(alreadyExists = true)

        assertTrue(updatedCard.alreadyExists)
        assertFalse(card.alreadyExists) // Original unchanged
    }

    @Test
    fun `CardPreview copy updates isAdded`() {
        val card = CardPreview(
            word = "test",
            definition = "def",
            exampleSentence = "ex",
            sentenceTranslation = "trans"
        )

        val addedCard = card.copy(isAdded = true)

        assertTrue(addedCard.isAdded)
        assertFalse(card.isAdded) // Original unchanged
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
        val userRole = MessageRole.USER
        val assistantRole = MessageRole.ASSISTANT

        assertEquals("USER", userRole.name)
        assertEquals("ASSISTANT", assistantRole.name)
    }
}
