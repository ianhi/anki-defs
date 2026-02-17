package com.word2anki.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.viewmodel.compose.viewModel
import com.word2anki.data.models.CardPreview
import com.word2anki.data.models.Deck
import com.word2anki.data.models.Message
import com.word2anki.data.models.MessageRole
import com.word2anki.ui.components.DeckSelector
import com.word2anki.ui.theme.Word2AnkiTheme
import com.word2anki.ui.components.MessageBubble
import com.word2anki.ui.components.MessageInput
import com.word2anki.viewmodel.ChatViewModel

@Composable
fun ChatScreen(
    onNavigateToSettings: () -> Unit,
    sharedText: String? = null,
    autoSend: Boolean = false,
    viewModel: ChatViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    val snackbarHostState = remember { SnackbarHostState() }
    val listState = rememberLazyListState()
    var showClearDialog by remember { mutableStateOf(false) }

    // Re-check Anki permission when returning from system settings
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.checkAnkiStatus()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    // Handle shared text (from share sheet or text selection toolbar)
    var consumedSharedText by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(sharedText) {
        if (sharedText != null && sharedText != consumedSharedText && sharedText.isNotBlank()) {
            consumedSharedText = sharedText
            viewModel.setSharedText(sharedText)
            if (autoSend) {
                viewModel.sendMessage()
            }
        }
    }

    // Handle errors
    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    // Handle card added confirmation
    val cardAddedEvent by viewModel.cardAddedEvent.collectAsState()
    LaunchedEffect(cardAddedEvent) {
        cardAddedEvent?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearCardAddedEvent()
        }
    }

    // Scroll to bottom when new message is added, but only if user is near the bottom
    val isNearBottom = remember {
        derivedStateOf {
            val lastVisibleItem = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            val totalItems = listState.layoutInfo.totalItemsCount
            totalItems == 0 || lastVisibleItem >= totalItems - 2
        }
    }

    LaunchedEffect(uiState.messages.size, uiState.messages.lastOrNull()?.content) {
        if (uiState.messages.isNotEmpty() && isNearBottom.value) {
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    ChatScreenContent(
        messages = uiState.messages,
        inputText = uiState.inputText,
        decks = uiState.decks,
        selectedDeck = uiState.selectedDeck,
        apiKeyConfigured = uiState.apiKeyConfigured,
        isAnkiAvailable = uiState.isAnkiAvailable,
        hasAnkiPermission = uiState.hasAnkiPermission,
        isGenerating = uiState.isGenerating,
        showClearDialog = showClearDialog,
        snackbarHostState = snackbarHostState,
        listState = listState,
        onInputChange = { viewModel.updateInputText(it) },
        onSend = { viewModel.sendMessage() },
        onDeckSelected = { viewModel.selectDeck(it) },
        onAddCard = { viewModel.addCardToAnki(it) },
        onEditCard = { messageId, card -> viewModel.updateCardPreview(messageId, card) },
        onDismissCard = { messageId -> viewModel.dismissCard(messageId) },
        onWordLookup = { word ->
            viewModel.updateInputText(word)
            viewModel.sendMessage()
        },
        onStopGeneration = { viewModel.cancelGeneration() },
        onRetry = { viewModel.retryLastMessage() },
        onNavigateToSettings = onNavigateToSettings,
        onShowClearDialog = { showClearDialog = it },
        onClearChat = {
            viewModel.clearChat()
            showClearDialog = false
        },
        onRetryAnkiPermission = { viewModel.checkAnkiStatus() },
        onInstallAnki = {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("https://play.google.com/store/apps/details?id=com.ichi2.anki")
            }
            context.startActivity(intent)
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChatScreenContent(
    messages: List<Message>,
    inputText: String,
    decks: List<Deck>,
    selectedDeck: Deck?,
    apiKeyConfigured: Boolean,
    isAnkiAvailable: Boolean,
    hasAnkiPermission: Boolean,
    isGenerating: Boolean = false,
    showClearDialog: Boolean = false,
    snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
    listState: LazyListState = rememberLazyListState(),
    onInputChange: (String) -> Unit = {},
    onSend: () -> Unit = {},
    onDeckSelected: (Deck) -> Unit = {},
    onAddCard: (CardPreview) -> Unit = {},
    onEditCard: (String, CardPreview) -> Unit = { _, _ -> },
    onDismissCard: (String) -> Unit = {},
    onWordLookup: (String) -> Unit = {},
    onStopGeneration: () -> Unit = {},
    onRetry: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {},
    onShowClearDialog: (Boolean) -> Unit = {},
    onClearChat: () -> Unit = {},
    onRetryAnkiPermission: () -> Unit = {},
    onInstallAnki: () -> Unit = {}
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("word2anki") },
                actions = {
                    if (messages.isNotEmpty()) {
                        IconButton(onClick = { onShowClearDialog(true) }) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = "Clear chat"
                            )
                        }
                    }
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Settings"
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
                .imePadding()
        ) {
            // Deck selector
            if (isAnkiAvailable && hasAnkiPermission && decks.isNotEmpty()) {
                DeckSelector(
                    decks = decks,
                    selectedDeck = selectedDeck,
                    onDeckSelected = onDeckSelected,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }

            // Warning banners
            if (!apiKeyConfigured) {
                WarningBanner(
                    message = "Please configure your Gemini API key in settings to use AI definitions.",
                    actionLabel = "Settings",
                    onAction = onNavigateToSettings
                )
            }

            if (!isAnkiAvailable) {
                WarningBanner(
                    message = "AnkiDroid is not installed. Install it to save flashcards.",
                    actionLabel = "Install",
                    onAction = onInstallAnki
                )
            } else if (!hasAnkiPermission) {
                WarningBanner(
                    message = "AnkiDroid permission required. Grant permission to save flashcards.",
                    actionLabel = "Retry",
                    onAction = onRetryAnkiPermission
                )
            }

            // Messages or empty state
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                if (messages.isEmpty()) {
                    EmptyState(modifier = Modifier.fillMaxSize())
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(
                            items = messages,
                            key = { it.id }
                        ) { message ->
                            MessageBubble(
                                message = message,
                                onAddCard = { cardPreview ->
                                    onAddCard(cardPreview)
                                },
                                onEditCard = onEditCard,
                                onDismissCard = onDismissCard,
                                onWordLookup = onWordLookup,
                                onRetry = onRetry
                            )
                        }
                    }
                }
            }

            // Input field
            MessageInput(
                value = inputText,
                onValueChange = onInputChange,
                onSend = onSend,
                enabled = !isGenerating && apiKeyConfigured,
                isGenerating = isGenerating,
                onStopGeneration = onStopGeneration,
                placeholder = if (!apiKeyConfigured) {
                    "Configure API key to start..."
                } else {
                    "Enter a word or sentence..."
                }
            )
        }
    }

    // Clear chat confirmation dialog
    if (showClearDialog) {
        AlertDialog(
            onDismissRequest = { onShowClearDialog(false) },
            title = { Text("Clear Chat?") },
            text = { Text("This will remove all messages from the current chat session.") },
            confirmButton = {
                TextButton(onClick = onClearChat) {
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

@Composable
private fun WarningBanner(
    message: String,
    actionLabel: String,
    onAction: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.weight(1f)
            )
            Spacer(modifier = Modifier.width(8.dp))
            TextButton(onClick = onAction) {
                Text(actionLabel)
            }
        }
    }
}

@Composable
private fun EmptyState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Welcome to word2anki",
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Enter a word to get its definition, or paste a sentence to analyze vocabulary.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Tips:",
            style = MaterialTheme.typography.titleSmall
        )

        Spacer(modifier = Modifier.height(8.dp))

        Column(
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            TipItem("Type a single word for quick definitions")
            TipItem("Paste sentences for vocabulary breakdown")
            TipItem("Use **word** to highlight specific words")
            TipItem("Ask follow-up questions for more examples")
            TipItem("Long-press a word in a response to look it up")
            TipItem("Tap 'Add to Anki' to save flashcards")
        }
    }
}

@Composable
private fun TipItem(text: String) {
    Text(
        text = "• $text",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
    )
}

// ==================== PREVIEWS ====================

private val previewDecks = listOf(
    Deck(id = 1, name = "Bangla Vocabulary"),
    Deck(id = 2, name = "Bangla Sentences")
)

private val previewMessages = listOf(
    Message(
        id = "1",
        role = MessageRole.USER,
        content = "সুন্দর"
    ),
    Message(
        id = "2",
        role = MessageRole.ASSISTANT,
        content = "**সুন্দর** (shundor) — Beautiful, pretty, nice\n\n*Adjective*\n\n**Examples:**\n1. এই ফুলটি খুব সুন্দর। — This flower is very beautiful.\n2. তোমার বাড়ি সুন্দর। — Your house is nice.",
        cardPreview = CardPreview(
            word = "সুন্দর",
            definition = "Beautiful, pretty, nice",
            exampleSentence = "এই ফুলটি খুব সুন্দর।",
            sentenceTranslation = "This flower is very beautiful."
        )
    )
)

@Preview(showBackground = true, name = "Chat - Empty State")
@Composable
private fun ChatScreenEmptyPreview() {
    Word2AnkiTheme {
        ChatScreenContent(
            messages = emptyList(),
            inputText = "",
            decks = previewDecks,
            selectedDeck = previewDecks[0],
            apiKeyConfigured = true,
            isAnkiAvailable = true,
            hasAnkiPermission = true
        )
    }
}

@Preview(showBackground = true, name = "Chat - With Messages", heightDp = 700)
@Composable
private fun ChatScreenWithMessagesPreview() {
    Word2AnkiTheme {
        ChatScreenContent(
            messages = previewMessages,
            inputText = "",
            decks = previewDecks,
            selectedDeck = previewDecks[0],
            apiKeyConfigured = true,
            isAnkiAvailable = true,
            hasAnkiPermission = true
        )
    }
}

@Preview(showBackground = true, name = "Chat - No API Key")
@Composable
private fun ChatScreenNoApiKeyPreview() {
    Word2AnkiTheme {
        ChatScreenContent(
            messages = emptyList(),
            inputText = "",
            decks = previewDecks,
            selectedDeck = previewDecks[0],
            apiKeyConfigured = false,
            isAnkiAvailable = true,
            hasAnkiPermission = true
        )
    }
}

@Preview(showBackground = true, name = "Chat - No AnkiDroid")
@Composable
private fun ChatScreenNoAnkiPreview() {
    Word2AnkiTheme {
        ChatScreenContent(
            messages = emptyList(),
            inputText = "",
            decks = emptyList(),
            selectedDeck = null,
            apiKeyConfigured = true,
            isAnkiAvailable = false,
            hasAnkiPermission = false
        )
    }
}

@Preview(showBackground = true, name = "Chat - Dark Theme", uiMode = android.content.res.Configuration.UI_MODE_NIGHT_YES, heightDp = 700)
@Composable
private fun ChatScreenDarkPreview() {
    Word2AnkiTheme(darkTheme = true) {
        ChatScreenContent(
            messages = previewMessages,
            inputText = "পানি",
            decks = previewDecks,
            selectedDeck = previewDecks[0],
            apiKeyConfigured = true,
            isAnkiAvailable = true,
            hasAnkiPermission = true
        )
    }
}

@Preview(showBackground = true, name = "Warning Banner")
@Composable
private fun WarningBannerPreview() {
    Word2AnkiTheme {
        WarningBanner(
            message = "Please configure your Gemini API key in settings.",
            actionLabel = "Settings",
            onAction = {}
        )
    }
}

@Preview(showBackground = true, name = "Empty State")
@Composable
private fun EmptyStatePreview() {
    Word2AnkiTheme {
        EmptyState()
    }
}
