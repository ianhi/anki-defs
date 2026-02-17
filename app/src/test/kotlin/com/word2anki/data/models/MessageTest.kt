package com.word2anki.data.models

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MessageTest {

    @Test
    fun `isError returns false for user messages`() {
        val msg = Message(role = MessageRole.USER, content = "Error: something")
        assertFalse(msg.isError)
    }

    @Test
    fun `isError returns false for streaming messages`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "Error: something", isStreaming = true)
        assertFalse(msg.isError)
    }

    @Test
    fun `isError returns true for cancelled message`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "(Cancelled)")
        assertTrue(msg.isError)
    }

    @Test
    fun `isError returns true for error prefix`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "Error: Something went wrong")
        assertTrue(msg.isError)
    }

    @Test
    fun `isError returns true for invalid API key`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "Invalid API key. Please check your Gemini API key in settings.")
        assertTrue(msg.isError)
    }

    @Test
    fun `isError returns true for rate limit`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "API rate limit reached. Please wait a moment and try again.")
        assertTrue(msg.isError)
    }

    @Test
    fun `isError returns true for network error`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "Network error. Please check your internet connection.")
        assertTrue(msg.isError)
    }

    @Test
    fun `isError returns true for timeout`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "Request timed out. Please check your internet connection and try again.")
        assertTrue(msg.isError)
    }

    @Test
    fun `isError returns true for safety block`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "Response was blocked by safety filters. Try rephrasing your input.")
        assertTrue(msg.isError)
    }

    @Test
    fun `isError returns false for normal assistant message`() {
        val msg = Message(role = MessageRole.ASSISTANT, content = "Hello! This is a definition of the word.")
        assertFalse(msg.isError)
    }
}
