package com.word2anki.data.models

import java.util.UUID

data class Message(
    val id: String = UUID.randomUUID().toString(),
    val role: MessageRole,
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val cardPreview: CardPreview? = null,
    val isStreaming: Boolean = false
)

enum class MessageRole {
    USER,
    ASSISTANT
}
