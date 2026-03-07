# Android File Map

All source under `app/src/main/kotlin/com/word2anki/`.

## Entry Points

- `MainActivity.kt` -- Entry point, navigation between screens
- `Word2AnkiApp.kt` -- Application class

## AI (`ai/`)

- `GeminiService.kt` -- Gemini API streaming client with multi-turn conversation context
- `PromptTemplates.kt` -- Prompt type detection (word/sentence/focused) and template generation
- `CardExtractor.kt` -- Parse AI responses into card data (JSON extraction with heuristic fallback)

## Data (`data/`)

- `AnkiRepository.kt` -- AnkiDroid ContentProvider wrapper (CRUD for decks and notes)
- `SettingsRepository.kt` -- DataStore Preferences operations
- `FlashCardsContract.kt` -- AnkiDroid URI constants
- `models/` -- Data classes: CardPreview, Deck, Message, NoteModel, Settings

## ViewModels (`viewmodel/`)

- `ChatViewModel.kt` -- Chat logic, AI interaction, card management
- `SettingsViewModel.kt` -- Settings validation and persistence

## UI (`ui/`)

- `screens/ChatScreen.kt` -- Main chat screen
- `screens/SettingsScreen.kt` -- Settings screen
- `components/` -- Reusable: CardPreviewComponent, DeckSelector, MarkdownText, MessageBubble, MessageInput, StreamingText
- `theme/` -- Material 3 Color, Theme, Type

## Tests

Located in `app/src/test/kotlin/com/word2anki/`:

- `ai/PromptTemplatesTest.kt` (23 tests), `ai/CardExtractorTest.kt` (24 tests)
- `viewmodel/ChatViewModelTest.kt` (12), `viewmodel/SettingsViewModelTest.kt` (8)
- `data/ModelsTest.kt` (9), `data/models/MessageTest.kt` (9), `ui/MarkdownTextTest.kt` (10)

## Custom Note Model

"word2anki" 4-field model: English, Bangla, ExampleSentence, SentenceTranslation.
Falls back to Basic model if custom model creation fails.
