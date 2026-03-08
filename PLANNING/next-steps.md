# Next Steps

## High Priority

### Manually test Anki add-on inside Anki Desktop

- Code is complete but has never been run inside Anki
- Need to verify: card creation, search, deletion, SSE streaming, prompt loading
- See `anki-addon/PLANNING/` for details

### Migrate Android to JSON-first pipeline

- Android still uses old two-call streaming markdown + extraction pipeline
- Should match web backend: single non-streaming LLM call returning JSON
- SSE events: only `usage`, `card_preview`, `done` (no more `text` events)

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
