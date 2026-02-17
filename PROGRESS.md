# word2anki - Development Progress

## Completed

### Code Quality & Structural Fixes (Plan: composed-seeking-papert.md)

- [x] **1. Eliminate Screen/Preview Duplication** - ChatScreen and SettingsScreen refactored to use single `*Content()` composable
- [x] **2. Fix Compiler Warnings** - All 3 warnings fixed (unused `isGranted`, `onRefreshDecks`, `onClearSettings`)
- [x] **3. Fix String Injection in AnkiRepository** - Added sanitization for `deckName` and `word` in `noteExists()`
- [x] **4. Fix CardExtractor split() Behavior** - Changed to `Regex(" [—–-] ")` for em-dash/en-dash/hyphen
- [x] **5. Improve Error Handling in GeminiService** - Removed error-swallowing try-catch in streaming flow
- [x] **6. Extract ChatViewModel Message Logic** - Split `sendMessage()` into 3 focused methods
- [x] **7. Add Missing proguard-rules.pro** - Already existed, no action needed
- [x] **8. Fix Unused Test Variable** - Added `assertNull(card)` assertion

### Build & Model Fixes

- [x] **Gemini model update** - Now using `gemini-2.5-flash`
- [x] **Build verification** - Zero warnings, all tests pass
- [x] **AnkiDroid note insertion fix** - Deck ID passed via ContentValues, not URI path segment

### Emulator Testing Setup

- [x] **Headless emulator running** - Pixel_7 AVD with API 34, KVM acceleration
- [x] **word2anki installed and running** - App launches correctly
- [x] **AnkiDroid installed (v2.23.3)** - Onboarding completed, permissions granted
- [x] **Deck created** - "Test Vocabulary" deck created in AnkiDroid

### End-to-End Testing (All Passing)

- [x] **English word definition** - "serendipity" → full definition, examples, card preview
- [x] **Add to Anki** - Card successfully added to AnkiDroid "Test Vocabulary" deck
- [x] **Bangla sentence with highlighted word** - `আমি গতকাল **বাজারে** গিয়েছিলাম` → correctly identifies "বাজারে" (to/at/in the market) with Bangla example + English translation
- [x] **Share intent** - Bangla text received via `android.intent.action.SEND`

### Feature Improvements (Plan: composed-seeking-papert.md)

- [x] **Card Editing & Dismiss** — Edit icon opens dialog with 4 fields, dismiss (X) removes card preview
- [x] **Conversation Context** — Multi-turn chat via Gemini `startChat(history)`, follow-ups work naturally
- [x] **Custom 4-Field Note Type** — "word2anki" model with English/Bangla/ExampleSentence/SentenceTranslation fields, falls back to Basic model

### Code Quality Refactoring

- [x] **Atomic state updates** — All `_uiState.value = .copy()` converted to `_uiState.update {}` in both ViewModels
- [x] **Channel for one-shot events** — Snackbar events in both ViewModels use `Channel<String>` instead of StateFlow
- [x] **Layer boundary fixes** — Removed GeminiService import from SettingsScreen, moved API key validation to SettingsViewModel
- [x] **Business logic out of UI** — Shared text deduplication moved from ChatScreen to `ChatViewModel.processSharedText()`
- [x] **CardExtractor split** — Monolithic `extractFromResponse` broken into `extractWord`, `extractDefinition`, `extractExample`
- [x] **AnkiRepository cleanup** — `NoteModel` data class, contract constants, `isAvailable` property, private visibility for internal methods, dead code removal
- [x] **SettingsViewModel DRY** — Extracted `saveWithFeedback()` helper deduplicating 3 save methods
- [x] **Test consolidation** — 95 tests across 7 classes, no duplicate coverage, all passing

## Future / Backlog

See `FUTURE_FEATURES.md` for detailed specs.

- [ ] On-device AI models (Gemma 3n for Pixel 7a) — eliminates API key dependency
- [ ] Chat history persistence (Room database)
- [ ] Audio pronunciation
- [ ] Word highlighting via long-press
- [ ] `ACTION_PROCESS_TEXT` intent for text selection toolbar
- [ ] Target language configuration
