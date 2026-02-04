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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.word2anki.data.models.CardPreview
import com.word2anki.ui.theme.Word2AnkiTheme
import com.word2anki.ui.theme.AddedBadgeColor
import com.word2anki.ui.theme.CardPreviewBackground
import com.word2anki.ui.theme.CardPreviewBackgroundDark
import com.word2anki.ui.theme.ExistsBadgeColor

@Composable
fun CardPreviewComponent(
    cardPreview: CardPreview,
    onAddCard: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isDarkTheme = isSystemInDarkTheme()
    val backgroundColor = if (isDarkTheme) CardPreviewBackgroundDark else CardPreviewBackground

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header with word and status badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = cardPreview.word,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                if (cardPreview.isAdded) {
                    StatusBadge(
                        text = "Added",
                        backgroundColor = AddedBadgeColor,
                        icon = Icons.Default.Check
                    )
                } else if (cardPreview.alreadyExists) {
                    StatusBadge(
                        text = "Exists",
                        backgroundColor = ExistsBadgeColor,
                        icon = Icons.Default.Warning
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Definition
            Text(
                text = cardPreview.definition,
                style = MaterialTheme.typography.bodyMedium
            )

            // Example sentence if available
            if (cardPreview.exampleSentence.isNotBlank()) {
                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "Example:",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = cardPreview.exampleSentence,
                    style = MaterialTheme.typography.bodyMedium,
                    fontStyle = FontStyle.Italic
                )

                if (cardPreview.sentenceTranslation.isNotBlank()) {
                    Text(
                        text = cardPreview.sentenceTranslation,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Add to Anki button
            Button(
                onClick = onAddCard,
                enabled = !cardPreview.isAdded,
                modifier = Modifier.fillMaxWidth(),
                colors = if (cardPreview.isAdded) {
                    ButtonDefaults.buttonColors(
                        disabledContainerColor = AddedBadgeColor.copy(alpha = 0.3f),
                        disabledContentColor = MaterialTheme.colorScheme.onSurface
                    )
                } else {
                    ButtonDefaults.buttonColors()
                }
            ) {
                Icon(
                    imageVector = if (cardPreview.isAdded) Icons.Default.Check else Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (cardPreview.isAdded) "Added to Anki" else "Add to Anki"
                )
            }
        }
    }
}

@Composable
private fun StatusBadge(
    text: String,
    backgroundColor: androidx.compose.ui.graphics.Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(backgroundColor.copy(alpha = 0.2f))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = backgroundColor
            )
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall,
                color = backgroundColor
            )
        }
    }
}

// ==================== PREVIEWS ====================

@Preview(showBackground = true, name = "Card - Ready to Add")
@Composable
private fun CardPreviewReadyPreview() {
    Word2AnkiTheme {
        CardPreviewComponent(
            cardPreview = CardPreview(
                word = "সুন্দর",
                definition = "Beautiful, pretty, nice",
                exampleSentence = "এই ফুলটি খুব সুন্দর।",
                sentenceTranslation = "This flower is very beautiful."
            ),
            onAddCard = {}
        )
    }
}

@Preview(showBackground = true, name = "Card - Already Added")
@Composable
private fun CardPreviewAddedPreview() {
    Word2AnkiTheme {
        CardPreviewComponent(
            cardPreview = CardPreview(
                word = "ভালোবাসা",
                definition = "Love, affection",
                exampleSentence = "মায়ের ভালোবাসা অতুলনীয়।",
                sentenceTranslation = "A mother's love is incomparable.",
                isAdded = true
            ),
            onAddCard = {}
        )
    }
}

@Preview(showBackground = true, name = "Card - Already Exists")
@Composable
private fun CardPreviewExistsPreview() {
    Word2AnkiTheme {
        CardPreviewComponent(
            cardPreview = CardPreview(
                word = "পানি",
                definition = "Water",
                exampleSentence = "আমি পানি খাচ্ছি।",
                sentenceTranslation = "I am drinking water.",
                alreadyExists = true
            ),
            onAddCard = {}
        )
    }
}

@Preview(showBackground = true, name = "Card - Minimal")
@Composable
private fun CardPreviewMinimalPreview() {
    Word2AnkiTheme {
        CardPreviewComponent(
            cardPreview = CardPreview(
                word = "হ্যাঁ",
                definition = "Yes",
                exampleSentence = "",
                sentenceTranslation = ""
            ),
            onAddCard = {}
        )
    }
}

@Preview(showBackground = true, name = "Card - Dark Theme", uiMode = android.content.res.Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun CardPreviewDarkPreview() {
    Word2AnkiTheme(darkTheme = true) {
        CardPreviewComponent(
            cardPreview = CardPreview(
                word = "রাত",
                definition = "Night",
                exampleSentence = "রাত অনেক সুন্দর।",
                sentenceTranslation = "The night is very beautiful."
            ),
            onAddCard = {}
        )
    }
}
