package com.word2anki.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.word2anki.data.models.Deck
import com.word2anki.ui.theme.Word2AnkiTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeckSelector(
    decks: List<Deck>,
    selectedDeck: Deck?,
    onDeckSelected: (Deck) -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { if (enabled) expanded = it },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = selectedDeck?.name ?: "Select a deck",
            onValueChange = {},
            readOnly = true,
            enabled = enabled,
            label = { Text("Deck") },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            if (decks.isEmpty()) {
                DropdownMenuItem(
                    text = {
                        Text(
                            "No decks available",
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    },
                    onClick = { expanded = false },
                    enabled = false
                )
            } else {
                decks.forEach { deck ->
                    DropdownMenuItem(
                        text = { Text(deck.name) },
                        onClick = {
                            onDeckSelected(deck)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

// ==================== PREVIEWS ====================

private val sampleDecks = listOf(
    Deck(id = 1, name = "Bangla Vocabulary"),
    Deck(id = 2, name = "Bangla Sentences"),
    Deck(id = 3, name = "Daily Words"),
    Deck(id = 4, name = "Advanced Grammar")
)

@Preview(showBackground = true, name = "With Selection")
@Composable
private fun DeckSelectorWithSelectionPreview() {
    Word2AnkiTheme {
        DeckSelector(
            decks = sampleDecks,
            selectedDeck = sampleDecks[0],
            onDeckSelected = {}
        )
    }
}

@Preview(showBackground = true, name = "No Selection")
@Composable
private fun DeckSelectorNoSelectionPreview() {
    Word2AnkiTheme {
        DeckSelector(
            decks = sampleDecks,
            selectedDeck = null,
            onDeckSelected = {}
        )
    }
}

@Preview(showBackground = true, name = "Empty Decks")
@Composable
private fun DeckSelectorEmptyPreview() {
    Word2AnkiTheme {
        DeckSelector(
            decks = emptyList(),
            selectedDeck = null,
            onDeckSelected = {}
        )
    }
}

@Preview(showBackground = true, name = "Disabled")
@Composable
private fun DeckSelectorDisabledPreview() {
    Word2AnkiTheme {
        DeckSelector(
            decks = sampleDecks,
            selectedDeck = sampleDecks[1],
            onDeckSelected = {},
            enabled = false
        )
    }
}
