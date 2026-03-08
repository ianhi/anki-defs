package com.word2anki.data.models

data class CardPreview(
    val word: String,
    val definition: String,
    val banglaDefinition: String = "",
    val exampleSentence: String,
    val sentenceTranslation: String,
    val spellingCorrection: String? = null,
    val alreadyExists: Boolean = false,
    val existingCard: Map<String, String>? = null,
    val isAdded: Boolean = false
)
