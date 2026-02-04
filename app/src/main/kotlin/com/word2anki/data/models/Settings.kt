package com.word2anki.data.models

data class Settings(
    val geminiApiKey: String = "",
    val defaultDeckName: String = "",
    val defaultDeckId: Long = 0L,
    val defaultModelId: Long = 0L
)
