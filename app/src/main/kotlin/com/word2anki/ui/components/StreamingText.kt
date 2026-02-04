package com.word2anki.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import kotlinx.coroutines.delay

/**
 * Text component that displays content character by character for streaming effect.
 */
@Composable
fun StreamingText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    isStreaming: Boolean = true,
    charDelayMs: Long = 10L
) {
    var displayedText by remember { mutableStateOf("") }
    var currentIndex by remember { mutableStateOf(0) }

    LaunchedEffect(text, isStreaming) {
        if (isStreaming) {
            // When streaming, animate to show new characters
            while (currentIndex < text.length) {
                displayedText = text.substring(0, currentIndex + 1)
                currentIndex++
                delay(charDelayMs)
            }
        } else {
            // When not streaming, show full text immediately
            displayedText = text
            currentIndex = text.length
        }
    }

    // Reset when text changes significantly (new message)
    LaunchedEffect(text) {
        if (text.length < currentIndex) {
            currentIndex = 0
            displayedText = ""
        }
    }

    Box(modifier = modifier) {
        Text(
            text = displayedText,
            style = style
        )
    }
}
