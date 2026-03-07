package com.word2anki.viewmodel

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SettingsViewModelTest {

    @Test
    fun `isValidApiKeyFormat returns false for empty string`() {
        assertFalse(SettingsViewModel.isValidApiKeyFormat(""))
    }

    @Test
    fun `isValidApiKeyFormat returns false for blank string`() {
        assertFalse(SettingsViewModel.isValidApiKeyFormat("   "))
    }

    @Test
    fun `isValidApiKeyFormat returns false for short string`() {
        assertFalse(SettingsViewModel.isValidApiKeyFormat("short"))
    }

    @Test
    fun `isValidApiKeyFormat returns true for string with 20 or more chars`() {
        assertTrue(SettingsViewModel.isValidApiKeyFormat("12345678901234567890"))
    }

    @Test
    fun `isValidApiKeyFormat returns true for typical API key length`() {
        val typicalKey = "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        assertTrue(SettingsViewModel.isValidApiKeyFormat(typicalKey))
    }

    @Test
    fun `isValidApiKeyFormat returns false for 19 chars`() {
        assertFalse(SettingsViewModel.isValidApiKeyFormat("1234567890123456789"))
    }

    @Test
    fun `isValidApiKeyFormat returns true for exactly 20 chars`() {
        assertTrue(SettingsViewModel.isValidApiKeyFormat("12345678901234567890"))
    }

    @Test
    fun `isValidApiKeyFormat returns false for whitespace-only long string`() {
        assertFalse(SettingsViewModel.isValidApiKeyFormat("                    "))
    }
}
