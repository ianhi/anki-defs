package com.word2anki.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.word2anki.data.models.Settings
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

class SettingsRepository(private val context: Context) {

    private object PreferencesKeys {
        val GEMINI_API_KEY = stringPreferencesKey("gemini_api_key")
        val DEFAULT_DECK_NAME = stringPreferencesKey("default_deck_name")
        val DEFAULT_DECK_ID = longPreferencesKey("default_deck_id")
        val DEFAULT_MODEL_ID = longPreferencesKey("default_model_id")
    }

    val settingsFlow: Flow<Settings> = context.dataStore.data.map { preferences ->
        Settings(
            geminiApiKey = preferences[PreferencesKeys.GEMINI_API_KEY] ?: "",
            defaultDeckName = preferences[PreferencesKeys.DEFAULT_DECK_NAME] ?: "",
            defaultDeckId = preferences[PreferencesKeys.DEFAULT_DECK_ID] ?: 0L,
            defaultModelId = preferences[PreferencesKeys.DEFAULT_MODEL_ID] ?: 0L
        )
    }

    suspend fun updateGeminiApiKey(apiKey: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.GEMINI_API_KEY] = apiKey
        }
    }

    suspend fun updateDefaultDeck(deckId: Long, deckName: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.DEFAULT_DECK_ID] = deckId
            preferences[PreferencesKeys.DEFAULT_DECK_NAME] = deckName
        }
    }

    suspend fun clearSettings() {
        context.dataStore.edit { preferences ->
            preferences.clear()
        }
    }
}
