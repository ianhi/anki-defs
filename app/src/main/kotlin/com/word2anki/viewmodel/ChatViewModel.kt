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
import com.word2anki.data.models.Settings
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
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
    val apiKeyConfigured: Boolean = false
)

class ChatViewModel(application: Application) : AndroidViewModel(application) {

    private val settingsRepository = SettingsRepository(application)
    private val ankiRepository = AnkiRepository(application)

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    val settings: StateFlow<Settings> = settingsRepository.settingsFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = Settings()
    )

    private var geminiService: GeminiService? = null
    private var generationJob: Job? = null

    init {
        viewModelScope.launch {
            // Observe settings changes
            settingsRepository.settingsFlow.collect { settings ->
                if (settings.geminiApiKey.isNotBlank()) {
                    geminiService = GeminiService(settings.geminiApiKey)
                    _uiState.value = _uiState.value.copy(apiKeyConfigured = true)
                } else {
                    _uiState.value = _uiState.value.copy(apiKeyConfigured = false)
                }

                // Update selected deck from settings
                if (settings.defaultDeckId != 0L && settings.defaultDeckName.isNotBlank()) {
                    val deck = Deck(settings.defaultDeckId, settings.defaultDeckName)
                    _uiState.value = _uiState.value.copy(selectedDeck = deck)
                }
            }
        }

        checkAnkiStatus()
    }

    fun checkAnkiStatus() {
        viewModelScope.launch {
            val isInstalled = ankiRepository.isAnkiDroidInstalled()
            val hasPermission = ankiRepository.hasAnkiPermission()

            _uiState.value = _uiState.value.copy(
                isAnkiAvailable = isInstalled,
                hasAnkiPermission = hasPermission
            )

            if (isInstalled && hasPermission) {
                loadDecks()
            }
        }
    }

    fun loadDecks() {
        viewModelScope.launch {
            try {
                val decks = ankiRepository.getDecks()
                _uiState.value = _uiState.value.copy(
                    decks = decks,
                    error = null
                )

                // Auto-select first deck if none selected
                if (_uiState.value.selectedDeck == null && decks.isNotEmpty()) {
                    selectDeck(decks.first())
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    error = "Failed to load decks: ${e.message}"
                )
            }
        }
    }

    fun selectDeck(deck: Deck) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(selectedDeck = deck)
            settingsRepository.updateDefaultDeck(deck.id, deck.name)
        }
    }

    fun updateInputText(text: String) {
        _uiState.value = _uiState.value.copy(inputText = text)
    }

    fun setSharedText(text: String) {
        _uiState.value = _uiState.value.copy(inputText = text)
    }

    fun sendMessage() {
        val text = _uiState.value.inputText.trim()
        if (text.isBlank()) return

        val service = geminiService
        if (service == null) {
            _uiState.value = _uiState.value.copy(
                error = "Please configure your Gemini API key in settings"
            )
            return
        }

        addUserAndPlaceholderMessages(text)

        generationJob = viewModelScope.launch {
            try {
                val finalResponse = streamResponse(service, text)
                extractAndAttachCard(service, text, finalResponse)
            } catch (e: Exception) {
                val errorMessage = "Error: ${e.message ?: "Unknown error occurred"}"
                updateLastMessage(errorMessage, isStreaming = false)
            } finally {
                _uiState.value = _uiState.value.copy(isGenerating = false)
            }
        }
    }

    private fun addUserAndPlaceholderMessages(text: String) {
        val userMessage = Message(
            role = MessageRole.USER,
            content = text
        )
        val assistantMessage = Message(
            role = MessageRole.ASSISTANT,
            content = "",
            isStreaming = true
        )
        _uiState.value = _uiState.value.copy(
            messages = _uiState.value.messages + userMessage + assistantMessage,
            inputText = "",
            isGenerating = true,
            error = null
        )
    }

    private suspend fun streamResponse(service: GeminiService, text: String): String {
        val responseBuilder = StringBuilder()
        service.generateStreamingResponse(text).collect { chunk ->
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

    private fun updateLastMessage(content: String, isStreaming: Boolean) {
        val messages = _uiState.value.messages.toMutableList()
        if (messages.isNotEmpty()) {
            val lastMessage = messages.last()
            if (lastMessage.role == MessageRole.ASSISTANT) {
                messages[messages.lastIndex] = lastMessage.copy(
                    content = content,
                    isStreaming = isStreaming
                )
                _uiState.value = _uiState.value.copy(messages = messages)
            }
        }
    }

    private fun updateLastMessageWithCard(cardPreview: CardPreview) {
        val messages = _uiState.value.messages.toMutableList()
        if (messages.isNotEmpty()) {
            val lastMessage = messages.last()
            if (lastMessage.role == MessageRole.ASSISTANT) {
                messages[messages.lastIndex] = lastMessage.copy(
                    cardPreview = cardPreview
                )
                _uiState.value = _uiState.value.copy(messages = messages)
            }
        }
    }

    fun addCardToAnki(cardPreview: CardPreview) {
        viewModelScope.launch {
            val selectedDeck = _uiState.value.selectedDeck
            if (selectedDeck == null) {
                _uiState.value = _uiState.value.copy(
                    error = "Please select a deck first"
                )
                return@launch
            }

            try {
                val settings = settingsRepository.settingsFlow.first()
                var modelId = settings.defaultModelId

                // Get model ID if not set
                if (modelId == 0L) {
                    modelId = ankiRepository.getBasicModelId() ?: run {
                        _uiState.value = _uiState.value.copy(
                            error = "No note models available in AnkiDroid"
                        )
                        return@launch
                    }
                    settingsRepository.updateDefaultModel(modelId)
                }

                // Build fields for Basic note type (Front, Back)
                val front = buildString {
                    append(cardPreview.word)
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

                val noteId = ankiRepository.addNote(
                    modelId = modelId,
                    deckId = selectedDeck.id,
                    fields = listOf(front, back),
                    tags = setOf("word2anki")
                )

                if (noteId != null) {
                    // Update card preview to show it was added
                    val messages = _uiState.value.messages.toMutableList()
                    val index = messages.indexOfLast {
                        it.cardPreview?.word == cardPreview.word
                    }
                    if (index != -1) {
                        val message = messages[index]
                        messages[index] = message.copy(
                            cardPreview = cardPreview.copy(isAdded = true)
                        )
                        _uiState.value = _uiState.value.copy(messages = messages)
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        error = "Failed to add card to AnkiDroid"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    error = "Error adding card: ${e.message}"
                )
            }
        }
    }

    fun clearChat() {
        generationJob?.cancel()
        _uiState.value = _uiState.value.copy(
            messages = emptyList(),
            isGenerating = false
        )
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    override fun onCleared() {
        super.onCleared()
        generationJob?.cancel()
    }
}
