package com.word2anki.data.models

data class CardPreview(
    val word: String,
    val definition: String,
    val exampleSentence: String,
    val sentenceTranslation: String,
    val alreadyExists: Boolean = false,
    val isAdded: Boolean = false
)
