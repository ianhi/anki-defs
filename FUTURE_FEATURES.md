# word2anki — Future Features

Features documented for future implementation. See `PROGRESS.md` for completed work.

---

## Easy Word Highlighting (UI)

**Problem:** Users must manually type `**word**` to highlight. No UI support.

**Solution:** Add a "Bold" (format_bold) icon button next to Send in `MessageInput.kt`. When text is selected, wraps it in `**...**`. When no selection, inserts `****` with cursor in middle.

**Requires:** Migrating `ChatUiState.inputText: String` to `TextFieldValue` to track selection range.

**Files:** `MessageInput.kt`, `ChatViewModel.kt`, `ChatScreen.kt`

---

## Share from Other Apps (ACTION_PROCESS_TEXT)

**Problem:** Currently uses `ACTION_SEND` which only appears in the share sheet. `ACTION_PROCESS_TEXT` appears in the text selection floating toolbar — much faster for looking up words while reading.

**Solution:**
1. Add `<intent-filter>` for `ACTION_PROCESS_TEXT` in `AndroidManifest.xml`
2. Handle `EXTRA_PROCESS_TEXT` in `MainActivity.handleIntent()`
3. Optionally auto-send the text (since user clearly wants a definition)

**Limitation:** Android doesn't provide surrounding sentence context via `ACTION_PROCESS_TEXT` — only the selected text. User must select a wider region for context.

**Files:** `AndroidManifest.xml`, `MainActivity.kt`

---

## Target Language Configuration

**Problem:** All definitions are in English. Users learning Bangla want definitions that include Bangla translations.

**Solution:**
1. Add `targetLanguage: String` to Settings/DataStore
2. Parameterize all prompts in `PromptTemplates.kt` with target language
3. Add language picker in SettingsScreen (presets: Bangla, Hindi, Spanish, French + custom)
4. Update CardExtractor to parse `targetDefinition` field

**Files:** `Settings.kt`, `SettingsRepository.kt`, `PromptTemplates.kt`, `GeminiService.kt`, `SettingsScreen.kt`, `CardExtractor.kt`

---

## On-Device AI Models (Gemma)

**Problem:** Requires internet + API key. On-device model would work offline.

**Options:**
- Gemma 3n E2B (2GB RAM) — small enough for Pixel 7a
- MediaPipe LLM Inference API for Android
- Google AI Edge SDK

**Tradeoffs:** Slower, less capable, but free and offline. Could be used as fallback when API quota is exhausted.

---

## Chat History Persistence

**Problem:** Messages are cleared when app closes.

**Solution:** Room database for message storage, with conversation sessions.

---

## Audio Pronunciation

**Problem:** No audio for vocabulary words.

**Solution:** Google Text-to-Speech API or a pronunciation API.

---

## Word Highlighting via Long-Press

**Problem:** In the AI response bubble, users can't long-press a word to look it up.

**Solution:** Make response text interactive — long-press on a word sends it as a new query.
