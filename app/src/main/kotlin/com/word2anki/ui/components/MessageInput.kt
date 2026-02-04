package com.word2anki.ui.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.word2anki.ui.theme.Word2AnkiTheme

@Composable
fun MessageInput(
    value: String,
    onValueChange: (String) -> Unit,
    onSend: () -> Unit,
    enabled: Boolean = true,
    placeholder: String = "Enter a word or sentence...",
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(8.dp),
        verticalAlignment = Alignment.Bottom
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text(placeholder) },
            enabled = enabled,
            maxLines = 4,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(
                onSend = { if (value.isNotBlank() && enabled) onSend() }
            ),
            shape = MaterialTheme.shapes.large
        )

        IconButton(
            onClick = onSend,
            enabled = value.isNotBlank() && enabled
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.Send,
                contentDescription = "Send",
                tint = if (value.isNotBlank() && enabled) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                }
            )
        }
    }
}

// ==================== PREVIEWS ====================

@Preview(showBackground = true, name = "Empty Input")
@Composable
private fun MessageInputEmptyPreview() {
    Word2AnkiTheme {
        MessageInput(
            value = "",
            onValueChange = {},
            onSend = {}
        )
    }
}

@Preview(showBackground = true, name = "With Text")
@Composable
private fun MessageInputWithTextPreview() {
    Word2AnkiTheme {
        MessageInput(
            value = "সুন্দর",
            onValueChange = {},
            onSend = {}
        )
    }
}

@Preview(showBackground = true, name = "Disabled")
@Composable
private fun MessageInputDisabledPreview() {
    Word2AnkiTheme {
        MessageInput(
            value = "",
            onValueChange = {},
            onSend = {},
            enabled = false,
            placeholder = "Configure API key to start..."
        )
    }
}

@Preview(showBackground = true, name = "Multi-line")
@Composable
private fun MessageInputMultiLinePreview() {
    Word2AnkiTheme {
        MessageInput(
            value = "আমি বাংলা শিখছি এবং এই বাক্যটি বুঝতে চাই।",
            onValueChange = {},
            onSend = {}
        )
    }
}
