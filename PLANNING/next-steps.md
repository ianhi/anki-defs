# Next Steps

## High Priority

### Manually test Anki add-on inside Anki Desktop

- Code is complete but has never been run inside Anki
- Need to verify: card creation, search, deletion, SSE streaming, prompt loading
- See `anki-addon/PLANNING/` for details

## Medium Priority

### Unmarked sentence mode

- Paste a sentence without highlighting any words → auto-detect which words are NOT in Anki
- Tokenize sentence, lemmatize each word, batch-check Anki, filter to unknown words
- Currently blocked in client UI (must highlight words manually)

### Disambiguation support

- Add `eng-disambig` and `bangla-disambig` fields for homonyms
- e.g. তারা = star vs they

### Cache prompt files in production

- `reloadPrompts()` is called on every `/api/prompts/preview` request for live editing
- For normal usage, prompts should be loaded once at startup
- Use `NODE_ENV` check or only reload in preview endpoint

## Lower Priority

### Cloze card support

- Add "Cloze+" note type toggle per card preview for grammar practice

### Web search verification

- Verify definitions via Samsad dictionary or Wiktionary for uncommon words

### ~~History and search~~ (DONE)

- Searchable history panel with debounced full-text search across word/definition/banglaDefinition
- `GET /api/session/history` endpoint with `?q=`, `?limit=`, `?offset=` pagination

### More test coverage

- SSE integration tests, auth middleware, React component tests
