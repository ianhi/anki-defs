# Settings Design: Target Language + Transliteration

## Current Settings Model

```kotlin
data class Settings(
    val geminiApiKey: String = "",
    val defaultDeckName: String = "",
    val defaultDeckId: Long = 0L,
    val defaultModelId: Long = 0L
)
```

## New Settings Model

```kotlin
data class Settings(
    val geminiApiKey: String = "",
    val defaultDeckName: String = "",
    val defaultDeckId: Long = 0L,
    val defaultModelId: Long = 0L,
    val targetLanguage: String = "Bangla",       // NEW
    val showTransliteration: Boolean = false      // NEW
)
```

## New DataStore Keys

- `target_language` (String, default "Bangla")
- `show_transliteration` (Boolean, default false)

## New SettingsRepository Methods

- `updateTargetLanguage(language: String)`
- `updateShowTransliteration(show: Boolean)`

## New SettingsViewModel Methods

- `updateTargetLanguage(language: String)` — calls saveWithFeedback
- `updateShowTransliteration(show: Boolean)` — calls saveWithFeedback

## Language Presets

Based on common language-learning targets:

- Bangla (default — matches anki-defs and current note model)
- Hindi
- Spanish
- French
- Japanese
- Korean
- Arabic
- Custom (free text)

## UI: SettingsScreen additions

New section "Language Settings" between API Key and AnkiDroid sections:

1. **Target Language** — Dropdown with presets + "Custom..." option that reveals a text field
2. **Show Transliteration** — Switch toggle with description text

## How targetLanguage flows through the system

```
Settings (DataStore)
  → SettingsViewModel.settings (StateFlow)
    → ChatViewModel collects settings flow
      → GeminiService.startChat(systemPrompt)
        → PromptTemplates.getUnifiedSystemPrompt(targetLanguage, showTransliteration)
```

ChatViewModel already creates GeminiService on init. It needs to recreate/update the chat when language changes.
