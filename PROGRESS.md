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

- [x] **Gemini model update** - Changed from `gemini-1.5-flash` to `gemini-2.0-flash` (old model returned 404)
- [x] **Build verification** - Zero warnings, all tests pass

### Emulator Testing Setup

- [x] **Headless emulator running** - Pixel_7 AVD with API 34, KVM acceleration
- [x] **word2anki installed and running** - App launches correctly
- [x] **AnkiDroid installed (v2.23.3)** - Onboarding completed, permissions granted
- [x] **Deck created** - "Test Vocabulary" deck created in AnkiDroid
- [x] **AnkiDroid integration verified** - word2anki detects deck and shows it in UI
- [x] **API call tested** - Gemini API called successfully (quota exceeded on free tier, but flow works)

## In Progress

### API Key / Quota

- [ ] **Gemini API quota** - Free tier quota exceeded for `gemini-2.0-flash`. Need a working API key or explore alternative models.

## Future / Backlog

- [ ] On-device AI models (Gemma 3n for Pixel 7a) - eliminates API key dependency
- [ ] Chat history persistence
- [ ] Custom note types support
- [ ] Audio pronunciation
- [ ] Word highlighting via long-press
