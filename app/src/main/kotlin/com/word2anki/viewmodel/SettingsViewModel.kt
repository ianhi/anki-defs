package com.word2anki.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.word2anki.data.AnkiRepository
import com.word2anki.data.SettingsRepository
import com.word2anki.data.models.Deck
import com.word2anki.data.models.Settings
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SettingsUiState(
    val decks: List<Deck> = emptyList(),
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val error: String? = null
)

class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val settingsRepository = SettingsRepository(application)
    private val ankiRepository = AnkiRepository(application)

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    private val _snackbarEvent = Channel<String>(Channel.BUFFERED)
    val snackbarEvent = _snackbarEvent.receiveAsFlow()

    val settings: StateFlow<Settings> = settingsRepository.settingsFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = Settings()
    )

    init {
        loadDecks()
    }

    private fun loadDecks() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val decks = ankiRepository.getDecks()
                _uiState.update { it.copy(decks = decks, isLoading = false, error = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Failed to load decks: ${e.message}") }
            }
        }
    }

    fun updateApiKey(apiKey: String) {
        saveWithFeedback("Settings saved", "Failed to save API key") {
            settingsRepository.updateGeminiApiKey(apiKey)
        }
    }

    fun updateDefaultDeck(deck: Deck) {
        saveWithFeedback("Deck preference saved", "Failed to save deck preference") {
            settingsRepository.updateDefaultDeck(deck.id, deck.name)
        }
    }

    fun clearAllSettings() {
        saveWithFeedback("Settings cleared", "Failed to clear settings") {
            settingsRepository.clearSettings()
        }
    }

    private fun saveWithFeedback(
        successMessage: String,
        errorPrefix: String,
        action: suspend () -> Unit
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true) }
            try {
                action()
                _uiState.update { it.copy(isSaving = false, error = null) }
                _snackbarEvent.send(successMessage)
            } catch (e: Exception) {
                _uiState.update { it.copy(isSaving = false, error = "$errorPrefix: ${e.message}") }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun refreshDecks() {
        loadDecks()
    }

    companion object {
        private const val MIN_API_KEY_LENGTH = 20

        fun isValidApiKeyFormat(apiKey: String): Boolean {
            return apiKey.isNotBlank() && apiKey.length >= MIN_API_KEY_LENGTH
        }
    }
}
