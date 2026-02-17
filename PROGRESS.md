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

## Future / Backlog

- [ ] On-device AI models (Gemma 3n for Pixel 7a) - eliminates API key dependency
- [ ] Chat history persistence
- [ ] Custom note types support
- [ ] Audio pronunciation
- [ ] Word highlighting via long-press
