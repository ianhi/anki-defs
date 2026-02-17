package com.word2anki.ui.components

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.material3.LocalTextStyle
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
import androidx.compose.ui.unit.sp

/**
 * Text component that renders markdown formatting:
 * - **bold** and *italic* text
 * - Horizontal rules (---) rendered as empty lines
 * - Bullet lists (- item) with indentation
 * - Numbered lists (1. item)
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
    // Process line by line first to handle block-level elements
    val lines = text.split('\n')
    return buildAnnotatedString {
        lines.forEachIndexed { lineIndex, line ->
            if (lineIndex > 0) append('\n')

            val trimmed = line.trim()
            when {
                // Horizontal rule
                trimmed.length >= 3 && trimmed.all { it == '-' } -> {
                    // Render as empty line (visual separator)
                }
                // Bullet list item: - text
                trimmed.startsWith("- ") -> {
                    append("  \u2022 ")
                    appendInlineMarkdown(trimmed.substring(2))
                }
                // Numbered list item: 1. text
                NUMBERED_LIST.matchesAt(trimmed, 0) -> {
                    val match = NUMBERED_LIST.find(trimmed)!!
                    append("  ${match.groupValues[1]} ")
                    appendInlineMarkdown(trimmed.substring(match.range.last + 1))
                }
                // Regular text with inline formatting
                else -> {
                    appendInlineMarkdown(line)
                }
            }
        }
    }
}

private fun AnnotatedString.Builder.appendInlineMarkdown(text: String) {
    var i = 0
    while (i < text.length) {
        when {
            // Bold: **text**
            i + 1 < text.length && text[i] == '*' && text[i + 1] == '*' -> {
                val end = text.indexOf("**", i + 2)
                if (end != -1) {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        appendInlineMarkdown(text.substring(i + 2, end))
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
            else -> {
                append(text[i])
                i++
            }
        }
    }
}

private val NUMBERED_LIST = Regex("^(\\d+\\.) ")

internal fun extractWordAt(text: String, offset: Int): String {
    if (offset < 0 || offset >= text.length) return ""
    var start = offset
    var end = offset
    while (start > 0 && !text[start - 1].isWhitespace()) start--
    while (end < text.length && !text[end].isWhitespace()) end++
    return text.substring(start, end)
        .trim { it in ".,;:!?()[]{}\"'" }
}
