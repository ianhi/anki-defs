package com.word2anki.data.models

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MessageTest {

    @Test
    fun `isError defaults to false`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "Hello")
        assertFalse(msg.isError)
    }

    @Test
    fun `isError can be set to true`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "Error: something", isError = true)
        assertTrue(msg.isError)
    }

    @Test
    fun `isError preserved through copy`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "Error", isError = true)
        val copied = msg.copy(content = "Updated error")
        assertTrue(copied.isError)
    }

    @Test
    fun `isError can be cleared through copy`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "Error", isError = true)
        val fixed = msg.copy(isError = false)
        assertFalse(fixed.isError)
    }

    @Test
    fun `user message defaults to not error`() {
        val msg = Message(role = MessageRole.USER, content = "hello")
        assertFalse(msg.isError)
    }

    @Test
    fun `isStreaming defaults to false`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "")
        assertFalse(msg.isStreaming)
    }

    @Test
    fun `cardPreview defaults to null`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "test")
        assertEquals(null, msg.cardPreview)
    }
}
