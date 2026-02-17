package com.word2anki.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.word2anki.data.models.CardPreview
import com.word2anki.ui.theme.Word2AnkiTheme
import com.word2anki.data.models.Message
import com.word2anki.data.models.MessageRole
import com.word2anki.ui.theme.AssistantBubbleColor
import com.word2anki.ui.theme.AssistantBubbleColorDark
import com.word2anki.ui.theme.UserBubbleColor
import com.word2anki.ui.theme.UserBubbleColorDark

@Composable
fun MessageBubble(
    message: Message,
    onAddCard: ((CardPreview) -> Unit)? = null,
    onEditCard: ((String, CardPreview) -> Unit)? = null,
    onDismissCard: ((String) -> Unit)? = null,
    onWordLookup: ((String) -> Unit)? = null,
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val isUser = message.role == MessageRole.USER
    val isDarkTheme = isSystemInDarkTheme()
    val configuration = LocalConfiguration.current
    val maxWidth = (configuration.screenWidthDp * 0.85f).dp

    val bubbleColor = when {
        isUser && isDarkTheme -> UserBubbleColorDark
        isUser -> UserBubbleColor
        isDarkTheme -> AssistantBubbleColorDark
        else -> AssistantBubbleColor
    }

    val bubbleShape = RoundedCornerShape(
        topStart = 16.dp,
        topEnd = 16.dp,
        bottomStart = if (isUser) 16.dp else 4.dp,
        bottomEnd = if (isUser) 4.dp else 16.dp
    )

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Column(
            modifier = Modifier.widthIn(max = maxWidth),
            horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
        ) {
            Box(
                modifier = Modifier
                    .clip(bubbleShape)
                    .background(bubbleColor)
                    .padding(12.dp)
            ) {
                if (message.isStreaming) {
                    StreamingText(
                        text = message.content,
                        style = MaterialTheme.typography.bodyLarge,
                        isStreaming = true
                    )
                } else if (!isUser) {
                    MarkdownText(
                        text = message.content,
                        style = MaterialTheme.typography.bodyLarge,
                        onWordLongPress = onWordLookup
                    )
                } else {
                    Text(
                        text = message.content,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }

            // Show retry button for error messages
            val isError = !isUser && !message.isStreaming && message.content.let {
                it.startsWith("Error:") || it.startsWith("Invalid API key") ||
                    it.startsWith("API rate limit") || it.startsWith("Network error") ||
                    it.startsWith("Request timed out") || it.startsWith("Response was blocked")
            }
            if (isError && onRetry != null) {
                TextButton(onClick = onRetry) {
                    Text("Retry", color = MaterialTheme.colorScheme.primary)
                }
            }

            // Show card preview if available
            message.cardPreview?.let { cardPreview ->
                Spacer(modifier = Modifier.height(8.dp))
                CardPreviewComponent(
                    cardPreview = cardPreview,
                    onAddCard = { onAddCard?.invoke(cardPreview) },
                    onEditCard = { edited -> onEditCard?.invoke(message.id, edited) },
                    onDismissCard = { onDismissCard?.invoke(message.id) }
                )
            }
        }
    }
}

// ==================== PREVIEWS ====================

@Preview(showBackground = true, name = "User Message")
@Composable
private fun UserMessagePreview() {
    Word2AnkiTheme {
        MessageBubble(
            message = Message(
                role = MessageRole.USER,
                content = "সুন্দর"
            )
        )
    }
}

@Preview(showBackground = true, name = "Assistant Message - Short")
@Composable
private fun AssistantMessageShortPreview() {
    Word2AnkiTheme {
        MessageBubble(
            message = Message(
                role = MessageRole.ASSISTANT,
                content = "**সুন্দর** (shundor) — Beautiful, pretty, nice\n\n*Adjective*"
            )
        )
    }
}

@Preview(showBackground = true, name = "Assistant Message - With Card", widthDp = 360)
@Composable
private fun AssistantMessageWithCardPreview() {
    Word2AnkiTheme {
        MessageBubble(
            message = Message(
                role = MessageRole.ASSISTANT,
                content = "**সুন্দর** (shundor) — Beautiful, pretty, nice\n\n*Adjective*\n\n**Examples:**\n1. এই ফুলটি খুব সুন্দর। — This flower is very beautiful.\n2. তোমার বাড়ি সুন্দর। — Your house is nice.",
                cardPreview = CardPreview(
                    word = "সুন্দর",
                    definition = "Beautiful, pretty, nice",
                    exampleSentence = "এই ফুলটি খুব সুন্দর।",
                    sentenceTranslation = "This flower is very beautiful."
                )
            ),
            onAddCard = {}
        )
    }
}

@Preview(showBackground = true, name = "User Message - Sentence")
@Composable
private fun UserMessageSentencePreview() {
    Word2AnkiTheme {
        MessageBubble(
            message = Message(
                role = MessageRole.USER,
                content = "আমি বাংলা শিখছি এবং এটা খুব **কঠিন**।"
            )
        )
    }
}

@Preview(showBackground = true, name = "Dark Theme - User", uiMode = android.content.res.Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun UserMessageDarkPreview() {
    Word2AnkiTheme(darkTheme = true) {
        MessageBubble(
            message = Message(
                role = MessageRole.USER,
                content = "পানি"
            )
        )
    }
}

@Preview(showBackground = true, name = "Dark Theme - Assistant", uiMode = android.content.res.Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun AssistantMessageDarkPreview() {
    Word2AnkiTheme(darkTheme = true) {
        MessageBubble(
            message = Message(
                role = MessageRole.ASSISTANT,
                content = "**পানি** (pani) — Water\n\n*Noun*"
            )
        )
    }
}
