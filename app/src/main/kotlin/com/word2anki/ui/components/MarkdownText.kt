package com.word2anki.ui.components

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle

/**
 * Text component that renders basic markdown formatting:
 * - **bold** text
 * - *italic* text
 * - Horizontal rules (---) rendered as empty lines
 */
@Composable
fun MarkdownText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    onWordLongPress: ((String) -> Unit)? = null
) {
    val annotated = remember(text) { parseMarkdown(text) }
    val layoutResult = remember { mutableStateOf<TextLayoutResult?>(null) }

    if (onWordLongPress != null) {
        Text(
            text = annotated,
            style = style,
            modifier = modifier.pointerInput(text) {
                detectTapGestures(
                    onLongPress = { offset ->
                        layoutResult.value?.let { layout ->
                            val charOffset = layout.getOffsetForPosition(offset)
                            val word = extractWordAt(annotated.text, charOffset)
                            if (word.isNotBlank()) {
                                onWordLongPress(word)
                            }
                        }
                    }
                )
            },
            onTextLayout = { layoutResult.value = it }
        )
    } else {
        Text(
            text = annotated,
            style = style,
            modifier = modifier
        )
    }
}

private fun parseMarkdown(text: String): AnnotatedString {
    return buildAnnotatedString {
        var i = 0
        while (i < text.length) {
            when {
                // Bold: **text**
                i + 1 < text.length && text[i] == '*' && text[i + 1] == '*' -> {
                    val end = text.indexOf("**", i + 2)
                    if (end != -1) {
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                            // Recursively handle italic inside bold
                            append(parseInlineMarkdown(text.substring(i + 2, end)))
                        }
                        i = end + 2
                    } else {
                        append(text[i])
                        i++
                    }
                }
                // Italic: *text* (but not **)
                text[i] == '*' && (i + 1 >= text.length || text[i + 1] != '*') -> {
                    val end = text.indexOf('*', i + 1)
                    if (end != -1 && end > i + 1) {
                        withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                            append(text.substring(i + 1, end))
                        }
                        i = end + 1
                    } else {
                        append(text[i])
                        i++
                    }
                }
                // Horizontal rule: --- at start of line, replace with empty line
                text[i] == '-' && isHorizontalRule(text, i) -> {
                    append("\n")
                    i = skipToNextLine(text, i)
                }
                else -> {
                    append(text[i])
                    i++
                }
            }
        }
    }
}

private fun parseInlineMarkdown(text: String): AnnotatedString {
    return buildAnnotatedString {
        var i = 0
        while (i < text.length) {
            if (text[i] == '*' && (i + 1 >= text.length || text[i + 1] != '*')) {
                val end = text.indexOf('*', i + 1)
                if (end != -1 && end > i + 1) {
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                        append(text.substring(i + 1, end))
                    }
                    i = end + 1
                } else {
                    append(text[i])
                    i++
                }
            } else {
                append(text[i])
                i++
            }
        }
    }
}

private fun isHorizontalRule(text: String, index: Int): Boolean {
    // Must be at start of line (or start of string)
    if (index > 0 && text[index - 1] != '\n') return false
    // Must have at least 3 dashes
    var count = 0
    var i = index
    while (i < text.length && text[i] == '-') {
        count++
        i++
    }
    // Must be followed by newline or end of string
    return count >= 3 && (i >= text.length || text[i] == '\n')
}

private fun skipToNextLine(text: String, index: Int): Int {
    var i = index
    while (i < text.length && text[i] != '\n') i++
    if (i < text.length) i++ // skip the newline itself
    return i
}

internal fun extractWordAt(text: String, offset: Int): String {
    if (offset < 0 || offset >= text.length) return ""
    var start = offset
    var end = offset
    while (start > 0 && !text[start - 1].isWhitespace()) start--
    while (end < text.length && !text[end].isWhitespace()) end++
    return text.substring(start, end)
        .trim { it in ".,;:!?()[]{}\"'" }
}
