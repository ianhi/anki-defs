package com.word2anki.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.word2anki.data.models.Deck
import com.word2anki.ui.theme.Word2AnkiTheme
import com.word2anki.ai.GeminiService
import com.word2anki.ui.components.DeckSelector
import com.word2anki.viewmodel.SettingsViewModel

@Composable
fun SettingsScreen(
    onNavigateBack: () -> Unit,
    viewModel: SettingsViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val settings by viewModel.settings.collectAsState()

    var apiKeyInput by remember(settings.geminiApiKey) {
        mutableStateOf(settings.geminiApiKey)
    }
    var showApiKey by remember { mutableStateOf(false) }
    var showClearDialog by remember { mutableStateOf(false) }

    val snackbarHostState = remember { SnackbarHostState() }

    // Handle save success
    LaunchedEffect(uiState.saveSuccess) {
        if (uiState.saveSuccess) {
            snackbarHostState.showSnackbar("Settings saved")
            viewModel.clearSaveSuccess()
        }
    }

    // Handle errors
    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    val selectedDeck = if (settings.defaultDeckId != 0L) {
        Deck(settings.defaultDeckId, settings.defaultDeckName)
    } else {
        null
    }

    SettingsScreenContent(
        apiKeyInput = apiKeyInput,
        showApiKey = showApiKey,
        decks = uiState.decks,
        selectedDeck = selectedDeck,
        isLoading = uiState.isLoading,
        showClearDialog = showClearDialog,
        snackbarHostState = snackbarHostState,
        saveEnabled = GeminiService.isValidApiKeyFormat(apiKeyInput) && apiKeyInput != settings.geminiApiKey,
        onApiKeyChange = { apiKeyInput = it },
        onToggleShowApiKey = { showApiKey = !showApiKey },
        onSaveApiKey = { viewModel.updateApiKey(apiKeyInput) },
        onDeckSelected = { viewModel.updateDefaultDeck(it) },
        onRefreshDecks = { viewModel.refreshDecks() },
        onShowClearDialog = { showClearDialog = it },
        onClearSettings = {
            viewModel.clearAllSettings()
            apiKeyInput = ""
            showClearDialog = false
        },
        onNavigateBack = onNavigateBack
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsScreenContent(
    apiKeyInput: String,
    showApiKey: Boolean,
    decks: List<Deck>,
    selectedDeck: Deck?,
    isLoading: Boolean = false,
    showClearDialog: Boolean = false,
    snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
    saveEnabled: Boolean = apiKeyInput.isNotBlank(),
    onApiKeyChange: (String) -> Unit = {},
    onToggleShowApiKey: () -> Unit = {},
    onSaveApiKey: () -> Unit = {},
    onDeckSelected: (Deck) -> Unit = {},
    onRefreshDecks: () -> Unit = {},
    onShowClearDialog: (Boolean) -> Unit = {},
    onClearSettings: () -> Unit = {},
    onNavigateBack: () -> Unit = {}
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // API Key Section
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Google Gemini API",
                        style = MaterialTheme.typography.titleMedium
                    )

                    Text(
                        text = "Enter your Gemini API key to enable AI-powered definitions. " +
                               "Get your key from Google AI Studio.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )

                    val isKeyInvalid = apiKeyInput.isNotBlank() &&
                        !GeminiService.isValidApiKeyFormat(apiKeyInput)

                    OutlinedTextField(
                        value = apiKeyInput,
                        onValueChange = onApiKeyChange,
                        label = { Text("API Key") },
                        placeholder = { Text("Enter your Gemini API key") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        isError = isKeyInvalid,
                        supportingText = if (isKeyInvalid) {
                            { Text("API key must be at least 20 characters") }
                        } else null,
                        visualTransformation = if (showApiKey) {
                            VisualTransformation.None
                        } else {
                            PasswordVisualTransformation()
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        trailingIcon = {
                            IconButton(onClick = onToggleShowApiKey) {
                                Icon(
                                    imageVector = if (showApiKey) {
                                        Icons.Default.VisibilityOff
                                    } else {
                                        Icons.Default.Visibility
                                    },
                                    contentDescription = if (showApiKey) "Hide" else "Show"
                                )
                            }
                        }
                    )

                    Button(
                        onClick = onSaveApiKey,
                        enabled = saveEnabled,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Save API Key")
                    }
                }
            }

            // Deck Selection Section
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "AnkiDroid Settings",
                        style = MaterialTheme.typography.titleMedium
                    )

                    Text(
                        text = "Select the default deck where new cards will be added.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )

                    DeckSelector(
                        decks = decks,
                        selectedDeck = selectedDeck,
                        onDeckSelected = onDeckSelected,
                        enabled = decks.isNotEmpty()
                    )

                    if (decks.isEmpty() && !isLoading) {
                        Text(
                            text = "No decks found. Make sure AnkiDroid is installed and has granted permissions.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )

                        OutlinedButton(
                            onClick = onRefreshDecks,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Refresh Decks")
                        }
                    }
                }
            }

            // Data Management Section
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Data Management",
                        style = MaterialTheme.typography.titleMedium
                    )

                    OutlinedButton(
                        onClick = { onShowClearDialog(true) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        Text("Clear All Settings")
                    }
                }
            }

            // About Section
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "About",
                        style = MaterialTheme.typography.titleMedium
                    )

                    Text(
                        text = "word2anki v1.0",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    Text(
                        text = "Create Anki flashcards from AI-generated vocabulary definitions. " +
                               "Uses Google Gemini for generating definitions and integrates " +
                               "with AnkiDroid for card management.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    // Clear settings confirmation dialog
    if (showClearDialog) {
        AlertDialog(
            onDismissRequest = { onShowClearDialog(false) },
            title = { Text("Clear All Settings?") },
            text = {
                Text("This will remove your API key and all preferences. This action cannot be undone.")
            },
            confirmButton = {
                TextButton(onClick = onClearSettings) {
                    Text("Clear", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { onShowClearDialog(false) }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ==================== PREVIEWS ====================

private val previewDecks = listOf(
    Deck(id = 1, name = "Bangla Vocabulary"),
    Deck(id = 2, name = "Bangla Sentences"),
    Deck(id = 3, name = "Daily Words")
)

@Preview(showBackground = true, name = "Settings - With Data")
@Composable
private fun SettingsScreenPreview() {
    Word2AnkiTheme {
        SettingsScreenContent(
            apiKeyInput = "AIzaSy...hidden",
            showApiKey = false,
            decks = previewDecks,
            selectedDeck = previewDecks[0]
        )
    }
}

@Preview(showBackground = true, name = "Settings - Empty State")
@Composable
private fun SettingsScreenEmptyPreview() {
    Word2AnkiTheme {
        SettingsScreenContent(
            apiKeyInput = "",
            showApiKey = false,
            decks = emptyList(),
            selectedDeck = null
        )
    }
}

@Preview(showBackground = true, name = "Settings - API Key Visible")
@Composable
private fun SettingsScreenApiVisiblePreview() {
    Word2AnkiTheme {
        SettingsScreenContent(
            apiKeyInput = "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            showApiKey = true,
            decks = previewDecks,
            selectedDeck = previewDecks[1]
        )
    }
}

@Preview(showBackground = true, name = "Settings - Dark Theme", uiMode = android.content.res.Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun SettingsScreenDarkPreview() {
    Word2AnkiTheme(darkTheme = true) {
        SettingsScreenContent(
            apiKeyInput = "AIzaSy...",
            showApiKey = false,
            decks = previewDecks,
            selectedDeck = previewDecks[0]
        )
    }
}
