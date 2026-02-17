package com.word2anki.data.models

import java.util.UUID

data class Message(
    val id: String = UUID.randomUUID().toString(),
    val role: MessageRole,
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val cardPreview: CardPreview? = null,
    val isStreaming: Boolean = false
) {
    val isError: Boolean
        get() = role == MessageRole.ASSISTANT && !isStreaming && content.let {
            it == "(Cancelled)" ||
                it.startsWith("Error:") ||
                it.startsWith("Invalid API key") ||
                it.startsWith("API rate limit") ||
                it.startsWith("Network error") ||
                it.startsWith("Request timed out") ||
                it.startsWith("Response was blocked")
        }
}

enum class MessageRole {
    USER,
    ASSISTANT
}
