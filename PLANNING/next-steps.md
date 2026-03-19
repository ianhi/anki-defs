# Next Steps

## High Priority

### Test and polish Anki add-on

- Code is hardened but never verified end-to-end inside Anki Desktop
- Run `install-dev.sh` as ian, restart Anki, test all flows:
  card creation, search, deletion, SSE streaming, settings/keyring
- Keyring consent flow and D-Bus fix need real-world testing
- Rebuild frontend into addon after UI changes (`install-dev.sh`)

### Cloze card support

- Add "Cloze" note type toggle per card preview for grammar practice
- Generate cloze deletions from example sentences (e.g. "মেয়েটা {{c1::কাঁদছে}}।")
- Need to detect cloze-compatible note types in the user's Anki collection
- Settings: option to auto-generate cloze cards alongside regular cards

### Theming

- Currently dark mode only (via Tailwind dark class)
- Add light/dark/system toggle in Settings > Preferences
- Respect `prefers-color-scheme` media query for system default
- Store preference in settings (persisted to server)

## Medium Priority

### Error UX polish

- Errors show in assistant bubbles (done) — wire up `useErrorModal.showError()`
  for non-recoverable errors (500s, unexpected failures)
- The ErrorModal component and store exist but nothing triggers `showError()` yet

### Unmarked sentence mode

- Paste a sentence without highlighting any words → auto-detect which words
  are NOT in Anki
- Tokenize sentence, lemmatize each word, batch-check Anki, filter to unknown words
- Currently blocked in client UI (must highlight words manually)

### Migrate Android to JSON-first pipeline

- Android still uses old two-call streaming markdown + extraction pipeline
- Should match web backend: single non-streaming LLM call returning JSON
- SSE events: only `usage`, `card_preview`, `done` (no more `text` events)

### Per-message streaming indicator

- With concurrent streaming, the loading indicator only shows on the last message
- Should show on any assistant message that's still loading

### Bangla disambiguation support

- Add `eng-disambig` and `bangla-disambig` fields for homonyms
- e.g. তারা = star vs they
- Note: English→Bangla disambiguation is already handled via sentence highlights

## Lower Priority

### Gemini grounding with web search

- Gemini API supports `google_search` tool for grounded responses
- Could verify definitions, find real example sentences, check transliterations
- Cost: $35/1,000 grounded requests (paid tier only, ~250x more than ungrounded)
- Should be opt-in toggle in settings, not default
- Implementation: add `tools: [{ google_search: {} }]` to Gemini API call

### Web search verification

- Verify definitions via Samsad dictionary or Wiktionary for uncommon words
