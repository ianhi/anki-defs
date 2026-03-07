package com.word2anki.ui

import com.word2anki.ui.components.extractWordAt
import org.junit.Assert.assertEquals
import org.junit.Test

class MarkdownTextTest {

    @Test
    fun `extractWordAt returns word at offset`() {
        val text = "hello world"
        assertEquals("hello", extractWordAt(text, 2))
        assertEquals("world", extractWordAt(text, 7))
    }

    @Test
    fun `extractWordAt strips punctuation`() {
        val text = "hello, world!"
        assertEquals("hello", extractWordAt(text, 2))
        assertEquals("world", extractWordAt(text, 8))
    }

    @Test
    fun `extractWordAt returns empty for out of bounds`() {
        assertEquals("", extractWordAt("hello", -1))
        assertEquals("", extractWordAt("hello", 10))
    }

    @Test
    fun `extractWordAt handles empty string`() {
        assertEquals("", extractWordAt("", 0))
    }

    @Test
    fun `extractWordAt handles single word`() {
        assertEquals("hello", extractWordAt("hello", 0))
        assertEquals("hello", extractWordAt("hello", 4))
    }

    @Test
    fun `extractWordAt handles non-Latin characters`() {
        val text = "সুন্দর মানে beautiful"
        assertEquals("সুন্দর", extractWordAt(text, 0))
        assertEquals("beautiful", extractWordAt(text, 14))
    }

    @Test
    fun `extractWordAt strips em-dash`() {
        assertEquals("word", extractWordAt("—word—", 3))
    }

    @Test
    fun `extractWordAt strips en-dash`() {
        assertEquals("word", extractWordAt("–word–", 3))
    }

    @Test
    fun `extractWordAt strips bullet character`() {
        assertEquals("item", extractWordAt("•item", 2))
    }

    @Test
    fun `extractWordAt handles parenthesized word`() {
        assertEquals("noun", extractWordAt("(noun)", 3))
    }
}
