# Android File Map

All source under `app/src/main/kotlin/com/word2anki/`.

## Entry Points

- `MainActivity.kt` -- Entry point, navigation between screens
- `Word2AnkiApp.kt` -- Application class

## AI (`ai/`)

- `GeminiService.kt` -- Gemini API client with JSON completion (`responseMimeType = "application/json"`) and text completion
- `SharedPromptLoader.kt` -- Loads shared prompt templates from `assets/prompts/*.json` with variable substitution (preamble, outputRules, languageRules, transliteration)
- `PromptTemplates.kt` -- Input type classification (word/sentence/focused)

## Data (`data/`)

- `AnkiRepository.kt` -- AnkiDroid ContentProvider wrapper (CRUD for decks and notes)
- `SettingsRepository.kt` -- DataStore Preferences operations
- `FlashCardsContract.kt` -- AnkiDroid URI constants
- `models/` -- Data classes: CardPreview (with banglaDefinition, spellingCorrection), Deck, Message, NoteModel, Settings

## Server (`server/`)

- `LocalServer.kt` -- NanoHTTPd server, routes requests to handlers, serves React frontend
- `ChatHandler.kt` -- JSON-first card pipeline: single AI call, JSON parse with fault tolerance, card preview building with Anki dedup
- `AnkiHandler.kt` -- Anki CRUD endpoints (decks, models, notes, search)
- `SettingsHandler.kt` -- Settings read/write endpoint

## Tests

Located in `app/src/test/kotlin/com/word2anki/`:

- `ai/PromptTemplatesTest.kt` (16 tests), `ai/SharedPromptLoaderTest.kt` (12 tests)
- `data/ModelsTest.kt` (9), `data/models/MessageTest.kt` (9)

Note: `viewmodel/ChatViewModelTest.kt` and `viewmodel/SettingsViewModelTest.kt` reference
deleted ViewModels and do not compile (pre-existing issue).

## Custom Note Model

"word2anki" 4-field model: English, Bangla, ExampleSentence, SentenceTranslation.
Returns null if creation fails; callers fall back to Basic model via getBasicModelId().
