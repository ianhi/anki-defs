package com.word2anki.ui.components

import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle

/**
 * Text component for streaming content. Shows text as-is since Gemini
 * already delivers content in chunks, providing a natural streaming effect.
 * Appends a cursor character while streaming is in progress.
 */
@Composable
fun StreamingText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    isStreaming: Boolean = true
) {
    val displayText = if (isStreaming && text.isNotEmpty()) "$text▍" else text

    Text(
        text = displayText,
        style = style,
        modifier = modifier
    )
}
