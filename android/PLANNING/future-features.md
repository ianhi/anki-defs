# Android Future Features

Features for future implementation. These are independent of the WebView migration
(Phases 2-7 in root [PLANNING/overview.md](../../PLANNING/overview.md)).

---

## Easy Word Highlighting (UI)

**Problem:** Users must manually type `**word**` to highlight. No UI support.

**Solution:** Add a "Bold" icon button next to Send in `MessageInput.kt`. When text is selected, wraps it in `**...**`. When no selection, inserts `****` with cursor in middle.

**Requires:** Migrating `ChatUiState.inputText: String` to `TextFieldValue` to track selection range.

---

## Share from Other Apps (ACTION_PROCESS_TEXT)

**Problem:** Currently uses `ACTION_SEND` which only appears in the share sheet. `ACTION_PROCESS_TEXT` appears in the text selection floating toolbar -- much faster for looking up words while reading.

**Solution:**

1. Add `<intent-filter>` for `ACTION_PROCESS_TEXT` in `AndroidManifest.xml`
2. Handle `EXTRA_PROCESS_TEXT` in `MainActivity.handleIntent()`
3. Optionally auto-send the text

**Limitation:** Android doesn't provide surrounding sentence context via `ACTION_PROCESS_TEXT` -- only the selected text.

---

## Target Language Configuration

**Problem:** All definitions are in English. Users learning Bangla want definitions that include Bangla translations.

**Solution:**

1. Add `targetLanguage: String` to Settings/DataStore
2. Parameterize all prompts in `PromptTemplates.kt` with target language
3. Add language picker in SettingsScreen
4. Update CardExtractor to parse `targetDefinition` field

---

## On-Device Translation (TranslateGemma)

**Problem:** Requires internet + API key. On-device translation would work offline.

**Solution:** Use TranslateGemma 4B for accurate translations in flashcard fields. Keep Gemini API for conversational tutor features.

**Prerequisites:** Target Language Configuration must be implemented first. Official Android-compatible MediaPipe bundle not yet available.

---

## On-Device AI Tutor (Gemma)

Gemma 3n E2B (2GB RAM) as fallback when API quota is exhausted. Slower but free and offline.

---

## Chat History Persistence

Room database for message storage with conversation sessions.

---

## Audio Pronunciation

Google Text-to-Speech API or a pronunciation API for vocabulary words.

---

## Word Highlighting via Long-Press

Make AI response text interactive -- long-press on a word sends it as a new query.
