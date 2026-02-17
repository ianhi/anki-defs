package com.word2anki.viewmodel

import kotlinx.coroutines.CancellationException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatViewModelTest {

    @Test
    fun `formatError returns cancelled for CancellationException`() {
        val error = CancellationException("Job was cancelled")
        val result = ChatViewModel.formatError(error)
        assertEquals("(Cancelled)", result)
    }

    @Test
    fun `formatError detects invalid API key from 401`() {
        val error = Exception("HTTP 401 Unauthorized")
        val result = ChatViewModel.formatError(error)
        assertTrue(result.contains("API key", ignoreCase = true))
    }

    @Test
    fun `formatError detects invalid API key from UNAUTHENTICATED`() {
        val error = Exception("UNAUTHENTICATED: Request had invalid authentication")
        val result = ChatViewModel.formatError(error)
        assertTrue(result.contains("API key", ignoreCase = true))
    }

    @Test
    fun `formatError detects rate limit from 429`() {
        val error = Exception("HTTP 429 Too Many Requests")
        val result = ChatViewModel.formatError(error)
        assertTrue(result.contains("rate limit", ignoreCase = true))
    }

    @Test
    fun `formatError detects rate limit from RESOURCE_EXHAUSTED`() {
        val error = Exception("RESOURCE_EXHAUSTED: Quota exceeded")
        val result = ChatViewModel.formatError(error)
        assertTrue(result.contains("rate limit", ignoreCase = true))
    }

    @Test
    fun `formatError detects quota exhaustion`() {
        val error = Exception("You've exceeded your quota for this model")
        val result = ChatViewModel.formatError(error)
        assertTrue(result.contains("rate limit", ignoreCase = true))
    }

    @Test
    fun `formatError detects network errors`() {
        val error = Exception("java.net.UnknownHostException: Unable to resolve host")
        val result = ChatViewModel.formatError(error)
        assertTrue(result.contains("Network error", ignoreCase = true))
    }

    @Test
    fun `formatError detects connection errors`() {
        val error = Exception("Failed to connect to server")
        val result = ChatViewModel.formatError(error)
        assertTrue(result.contains("Network error", ignoreCase = true))
    }

    @Test
    fun `formatError detects safety filter blocks`() {
        val error = Exception("Response was blocked due to safety settings")
        val result = ChatViewModel.formatError(error)
        assertTrue(result.contains("safety filters", ignoreCase = true))
    }

    @Test
    fun `formatError returns generic message for unknown errors`() {
        val error = Exception("Something weird happened")
        val result = ChatViewModel.formatError(error)
        assertEquals("Error: Something weird happened", result)
    }

    @Test
    fun `formatError handles null message`() {
        val error = Exception(null as String?)
        val result = ChatViewModel.formatError(error)
        assertEquals("Error: Unknown error occurred", result)
    }
}
