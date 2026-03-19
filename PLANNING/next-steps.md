# Next Steps

## High Priority

### Error UX overhaul

- Errors around prompts should show as AI response messages, not banners/inline text
- API key missing → assistant bubble: "I need a Gemini API key. Go to Settings > AI Provider."
- Rate limit / network errors → assistant message with retry button
- Card creation errors already show inline on cards (done in hardening)
- Wire up `useErrorModal.showError()` for non-recoverable errors (500s, unexpected failures)
- The ErrorModal component and store exist but nothing triggers `showError()` yet

### Manually test Anki add-on inside Anki Desktop

- Code is hardened but has never been verified end-to-end inside Anki
- Need to verify: card creation, search, deletion, SSE streaming, settings/keyring
- The keyring consent flow and D-Bus fix need real-world testing
- Run `install-dev.sh` as ian, restart Anki, test all flows

### Migrate Android to JSON-first pipeline

- Android still uses old two-call streaming markdown + extraction pipeline
- Should match web backend: single non-streaming LLM call returning JSON
- SSE events: only `usage`, `card_preview`, `done` (no more `text` events)

### In-app help / about page

- Currently the ? button links to the external docs site
- Should have an in-app page covering: how AI generation works, note type setup,
  field mapping explained, troubleshooting (Anki not connected, API key errors)
- Could reuse the onboarding modal pattern for a multi-page guide

## Medium Priority

### Unmarked sentence mode

- Paste a sentence without highlighting any words → auto-detect which words are NOT in Anki
- Tokenize sentence, lemmatize each word, batch-check Anki, filter to unknown words
- Currently blocked in client UI (must highlight words manually)

### Bangla disambiguation support

- Add `eng-disambig` and `bangla-disambig` fields for homonyms
- e.g. তারা = star vs they
- Note: English→Bangla disambiguation is already handled via sentence highlights

### Per-message streaming indicator

- With concurrent streaming, the loading indicator only shows on the last message
- Should show on any assistant message that's still loading

## Lower Priority

### Cloze card support

- Add "Cloze+" note type toggle per card preview for grammar practice

### Web search verification

- Verify definitions via Samsad dictionary or Wiktionary for uncommon words
