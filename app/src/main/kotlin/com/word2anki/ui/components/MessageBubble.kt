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
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import com.word2anki.data.models.CardPreview
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
                } else {
                    Text(
                        text = message.content,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }

            // Show card preview if available
            message.cardPreview?.let { cardPreview ->
                Spacer(modifier = Modifier.height(8.dp))
                CardPreviewComponent(
                    cardPreview = cardPreview,
                    onAddCard = { onAddCard?.invoke(cardPreview) }
                )
            }
        }
    }
}
