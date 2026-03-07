# Quick Translate: Native Popup

## Purpose
When a user selects text in any app and taps "word2anki" in the text selection toolbar, show a lightweight native popup instead of opening the full WebView app.

## Why Native (not WebView)
- WebView takes 300-500ms to initialize — too slow for a quick interaction
- Popup only needs: word, definition, "Add to Anki" button
- ~200 lines of Compose — not a maintenance burden

## Design
Small floating Activity with:
1. The selected word (bold, large)
2. AI-generated definition (streaming)
3. Example sentence + translation
4. "Add to Anki" button (one tap)
5. "Open in word2anki" link (opens full app)

## Implementation (future phase)
- `QuickTranslateActivity.kt` with `android:theme="@style/FloatingDialog"`
- Uses same GeminiService + AnkiRepository as main app
- No navigation, no chat history — single-purpose

## Priority: Later
This is a Phase 7 feature. The main WebView app handles ACTION_PROCESS_TEXT fine for now — it just opens the full app. The popup is a polish/speed optimization.
