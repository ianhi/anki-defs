package com.word2anki.ai

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GeminiServiceTest {

    @Test
    fun `isValidApiKeyFormat returns false for empty string`() {
        assertFalse(GeminiService.isValidApiKeyFormat(""))
    }

    @Test
    fun `isValidApiKeyFormat returns false for blank string`() {
        assertFalse(GeminiService.isValidApiKeyFormat("   "))
    }

    @Test
    fun `isValidApiKeyFormat returns false for short string`() {
        assertFalse(GeminiService.isValidApiKeyFormat("short"))
    }

    @Test
    fun `isValidApiKeyFormat returns true for string with 20 or more chars`() {
        assertTrue(GeminiService.isValidApiKeyFormat("12345678901234567890"))
    }

    @Test
    fun `isValidApiKeyFormat returns true for typical API key length`() {
        val typicalKey = "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        assertTrue(GeminiService.isValidApiKeyFormat(typicalKey))
    }

    @Test
    fun `isValidApiKeyFormat returns false for 19 chars`() {
        assertFalse(GeminiService.isValidApiKeyFormat("1234567890123456789"))
    }

    @Test
    fun `isValidApiKeyFormat returns true for exactly 20 chars`() {
        assertTrue(GeminiService.isValidApiKeyFormat("12345678901234567890"))
    }

    @Test
    fun `isValidApiKeyFormat returns false for whitespace-only long string`() {
        assertFalse(GeminiService.isValidApiKeyFormat("                    "))
    }
}
