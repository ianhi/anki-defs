package com.word2anki.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.word2anki.ai.GeminiService
import com.word2anki.data.AnkiRepository
import com.word2anki.data.SettingsRepository
import com.word2anki.data.models.CardPreview
import com.word2anki.data.models.Deck
import com.word2anki.data.models.Message
import com.word2anki.data.models.MessageRole
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChatUiState(
    val messages: List<Message> = emptyList(),
    val inputText: String = "",
    val isGenerating: Boolean = false,
    val decks: List<Deck> = emptyList(),
    val selectedDeck: Deck? = null,
    val isAnkiAvailable: Boolean = false,
    val hasAnkiPermission: Boolean = false,
    val error: String? = null,
    val apiKeyConfigured: Boolean = false,
    val isAddingCard: Boolean = false
)

class ChatViewModel(application: Application) : AndroidViewModel(application) {

    private val settingsRepository = SettingsRepository(application)
    private val ankiRepository = AnkiRepository(application)

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    private val _snackbarEvent = Channel<String>(Channel.BUFFERED)
    val snackbarEvent = _snackbarEvent.receiveAsFlow()

    private var geminiService: GeminiService? = null
    private var currentApiKey: String = ""
    private var generationJob: Job? = null

    init {
        viewModelScope.launch {
            // Observe settings changes
            settingsRepository.settingsFlow.collect { settings ->
                if (settings.geminiApiKey.isNotBlank()) {
                    // Only recreate service if key changed
                    if (settings.geminiApiKey != currentApiKey) {
                        currentApiKey = settings.geminiApiKey
                        geminiService = GeminiService(settings.geminiApiKey)
                    }
                    _uiState.update { it.copy(apiKeyConfigured = true) }
                } else {
                    currentApiKey = ""
                    geminiService = null
                    _uiState.update { it.copy(apiKeyConfigured = false) }
                }

                // Update selected deck from settings
                if (settings.defaultDeckId != 0L && settings.defaultDeckName.isNotBlank()) {
                    val deck = Deck(settings.defaultDeckId, settings.defaultDeckName)
                    _uiState.update { it.copy(selectedDeck = deck) }
                }
            }
        }

        checkAnkiStatus()
    }

    fun checkAnkiStatus() {
        viewModelScope.launch {
            val isInstalled = ankiRepository.isAnkiDroidInstalled()
            val hasPermission = ankiRepository.hasAnkiPermission()

            _uiState.update {
                it.copy(isAnkiAvailable = isInstalled, hasAnkiPermission = hasPermission)
            }

            if (isInstalled && hasPermission) {
                loadDecks()
            }
        }
    }

    private fun loadDecks() {
        viewModelScope.launch {
            try {
                val decks = ankiRepository.getDecks()
                _uiState.update { it.copy(decks = decks, error = null) }

                // Auto-select first deck if none selected
                if (_uiState.value.selectedDeck == null && decks.isNotEmpty()) {
                    selectDeck(decks.first())
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = "Failed to load decks: ${e.message}") }
            }
        }
    }

    fun selectDeck(deck: Deck) {
        viewModelScope.launch {
            _uiState.update { it.copy(selectedDeck = deck) }
            settingsRepository.updateDefaultDeck(deck.id, deck.name)
        }
    }

    fun updateInputText(text: String) {
        _uiState.update { it.copy(inputText = text) }
    }

    private var lastProcessedSharedText: String? = null

    fun processSharedText(text: String?, autoSend: Boolean) {
        if (text == null || text.isBlank() || text == lastProcessedSharedText) return
        lastProcessedSharedText = text
        updateInputText(text)
        if (autoSend) sendMessage()
    }

    fun retryLastMessage() {
        val messages = _uiState.value.messages
        val lastUserMsg = messages.lastOrNull { it.role == MessageRole.USER } ?: return
        val cleaned = messages.dropLastWhile { it.id != lastUserMsg.id }.dropLast(1)
        _uiState.update { it.copy(messages = cleaned) }
        sendMessage(lastUserMsg.content)
    }

    fun cancelGeneration() {
        generationJob?.cancel()
        generationJob = null
        _uiState.update { state ->
            val messages = state.messages.toMutableList()
            if (messages.isNotEmpty() && messages.last().role == MessageRole.ASSISTANT) {
                val last = messages.last()
                if (last.isStreaming) {
                    val cancelled = last.content.isEmpty()
                    messages[messages.lastIndex] = last.copy(
                        content = if (cancelled) "(Cancelled)" else last.content,
                        isStreaming = false,
                        isError = cancelled
                    )
                }
            }
            state.copy(messages = messages, isGenerating = false)
        }
    }

    fun sendMessage() {
        generateResponse(_uiState.value.inputText.trim())
    }

    fun sendMessage(text: String) {
        generateResponse(text)
    }

    private fun generateResponse(text: String) {
        if (text.isBlank() || _uiState.value.isGenerating) return

        val service = geminiService
        if (service == null) {
            _uiState.update { it.copy(error = "Please configure your Gemini API key in settings") }
            return
        }

        addUserAndPlaceholderMessages(text)

        generationJob = viewModelScope.launch {
            try {
                val finalResponse = streamResponse(service, text)
                extractAndAttachCard(service, text, finalResponse)
            } catch (e: Exception) {
                val errorMessage = formatError(e)
                updateLastMessage(errorMessage, isStreaming = false, isError = true)
            } finally {
                _uiState.update { it.copy(isGenerating = false) }
            }
        }
    }

    private fun addUserAndPlaceholderMessages(text: String) {
        val userMessage = Message(role = MessageRole.USER, content = text)
        val assistantMessage = Message(role = MessageRole.ASSISTANT, content = "", isStreaming = true)
        _uiState.update {
            it.copy(
                messages = it.messages + userMessage + assistantMessage,
                inputText = "",
                isGenerating = true,
                error = null
            )
        }
    }

    private suspend fun streamResponse(service: GeminiService, text: String): String {
        // Build conversation history: completed message pairs, excluding errors and cancelled
        val allMessages = _uiState.value.messages
        val history = allMessages.filter {
            !it.isStreaming && it.content.isNotBlank() && !it.isError
        }.dropLast(1) // Drop the current user message (the one we're about to send)
        val responseBuilder = StringBuilder()
        service.generateStreamingResponse(text, history).collect { chunk ->
            responseBuilder.append(chunk)
            updateLastMessage(responseBuilder.toString(), isStreaming = true)
        }
        val finalResponse = responseBuilder.toString()
        updateLastMessage(finalResponse, isStreaming = false)
        return finalResponse
    }

    private suspend fun extractAndAttachCard(service: GeminiService, userInput: String, response: String) {
        val cardPreview = service.extractCard(userInput, response) ?: return

        val selectedDeck = _uiState.value.selectedDeck
        val checkedPreview = if (selectedDeck != null) {
            val exists = ankiRepository.noteExists(cardPreview.word, selectedDeck.name)
            cardPreview.copy(alreadyExists = exists)
        } else {
            cardPreview
        }

        updateLastMessageWithCard(checkedPreview)
    }

    private fun updateLastMessage(content: String, isStreaming: Boolean, isError: Boolean = false) {
        updateMessage(
            findIndex = { it.lastIndex.takeIf { i -> i >= 0 && it[i].role == MessageRole.ASSISTANT } },
            transform = { it.copy(content = content, isStreaming = isStreaming, isError = isError) }
        )
    }

    private fun updateLastMessageWithCard(cardPreview: CardPreview) {
        updateMessage(
            findIndex = { it.lastIndex.takeIf { i -> i >= 0 && it[i].role == MessageRole.ASSISTANT } },
            transform = { it.copy(cardPreview = cardPreview) }
        )
    }

    fun updateCardPreview(messageId: String, updatedCard: CardPreview) {
        updateMessage(
            findIndex = { messages -> messages.indexOfFirst { it.id == messageId }.takeIf { it != -1 } },
            transform = { it.copy(cardPreview = updatedCard) }
        )
    }

    fun dismissCard(messageId: String) {
        updateMessage(
            findIndex = { messages -> messages.indexOfFirst { it.id == messageId }.takeIf { it != -1 } },
            transform = { it.copy(cardPreview = null) }
        )
    }

    private inline fun updateMessage(
        findIndex: (List<Message>) -> Int?,
        transform: (Message) -> Message
    ) {
        _uiState.update { state ->
            val index = findIndex(state.messages) ?: return@update state
            state.copy(
                messages = state.messages.toMutableList().also {
                    it[index] = transform(it[index])
                }
            )
        }
    }

    fun addCardToAnki(cardPreview: CardPreview) {
        if (_uiState.value.isAddingCard) return
        viewModelScope.launch {
            _uiState.update { it.copy(isAddingCard = true) }
            try {
                val selectedDeck = _uiState.value.selectedDeck
                if (selectedDeck == null) {
                    _uiState.update { it.copy(error = "Please select a deck first") }
                    return@launch
                }

                val noteFields = buildNoteFields(cardPreview) ?: return@launch
                val noteId = ankiRepository.addNote(
                    modelId = noteFields.first,
                    deckId = selectedDeck.id,
                    fields = noteFields.second,
                    tags = setOf("word2anki")
                )

                if (noteId != null) {
                    updateMessage(
                        findIndex = { msgs ->
                            msgs.indexOfLast { it.cardPreview?.word == cardPreview.word }
                                .takeIf { it != -1 }
                        },
                        transform = { it.copy(cardPreview = cardPreview.copy(isAdded = true)) }
                    )
                    _uiState.update { it.copy(error = null) }
                    _snackbarEvent.send("\"${cardPreview.word}\" added to ${selectedDeck.name}")
                } else {
                    _uiState.update { it.copy(error = "Failed to add card to AnkiDroid") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = "Error adding card: ${e.message}") }
            } finally {
                _uiState.update { it.copy(isAddingCard = false) }
            }
        }
    }

    /**
     * Resolve the note model and build field values for a card.
     * Returns Pair(modelId, fields) or null if no model is available.
     */
    private suspend fun buildNoteFields(cardPreview: CardPreview): Pair<Long, List<String>>? {
        if (cardPreview.word.isBlank() || cardPreview.definition.isBlank()) {
            _uiState.update { it.copy(error = "Card must have a word and definition") }
            return null
        }

        // Try word2anki 4-field model first
        val word2ankiModelId = ankiRepository.ensureWord2AnkiModel()
        if (word2ankiModelId != null) {
            return word2ankiModelId to listOf(
                cardPreview.word,
                cardPreview.definition,
                cardPreview.exampleSentence,
                cardPreview.sentenceTranslation
            )
        }

        // Fall back to Basic model (Front, Back)
        val settings = settingsRepository.settingsFlow.first()
        val modelId = if (settings.defaultModelId != 0L) {
            settings.defaultModelId
        } else {
            ankiRepository.getBasicModelId() ?: run {
                _uiState.update { it.copy(error = "No note models available in AnkiDroid") }
                return null
            }
        }

        val back = buildString {
            append(cardPreview.definition)
            if (cardPreview.exampleSentence.isNotBlank()) {
                append("<br><br><i>${cardPreview.exampleSentence}</i>")
                if (cardPreview.sentenceTranslation.isNotBlank()) {
                    append("<br>${cardPreview.sentenceTranslation}")
                }
            }
        }
        return modelId to listOf(cardPreview.word, back)
    }

    fun clearChat() {
        generationJob?.cancel()
        lastProcessedSharedText = null
        _uiState.update { it.copy(messages = emptyList(), isGenerating = false) }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    override fun onCleared() {
        super.onCleared()
        generationJob?.cancel()
    }

    companion object {
        fun formatError(e: Exception): String {
            val message = e.message ?: ""
            return when {
                e is TimeoutCancellationException ->
                    "Request timed out. Please check your internet connection and try again."
                e is CancellationException -> "(Cancelled)"
                message.contains("API key", ignoreCase = true) ||
                    message.contains("401") ||
                    message.contains("UNAUTHENTICATED", ignoreCase = true) ->
                    "Invalid API key. Please check your Gemini API key in settings."
                message.contains("429") ||
                    message.contains("RESOURCE_EXHAUSTED", ignoreCase = true) ||
                    message.contains("quota", ignoreCase = true) ->
                    "API rate limit reached. Please wait a moment and try again."
                message.contains("network", ignoreCase = true) ||
                    message.contains("connect", ignoreCase = true) ||
                    message.contains("UnknownHostException", ignoreCase = true) ->
                    "Network error. Please check your internet connection."
                message.contains("safety", ignoreCase = true) ||
                    message.contains("blocked", ignoreCase = true) ->
                    "Response was blocked by safety filters. Try rephrasing your input."
                else -> "Error: ${message.ifEmpty { "Unknown error occurred" }}"
            }
        }
    }
}
