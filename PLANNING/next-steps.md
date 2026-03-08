# Next Steps

## High Priority

### Test the new prompts end-to-end

- Submit various sentences and single words to verify the improved prompts produce correct lemmatization, clean definitions, and real example sentences
- Specifically test: verb forms (কাঁদতে, যাচ্ছে, গেছে), noun case endings (বাজারে, বাজারের), adjectives
- Verify the lemma mismatch badge appears when it should and not when it shouldn't

### ~~Card field mapping~~ (Done)

- Field mapping is now configurable in Settings UI
- Maps card data fields (Word, Definition, Example, Translation) to note type fields
- Default mapping targets "Bangla (and reversed)" note type fields
- Stored in settings.json and persisted across sessions

### ~~Sentence mode highlighting~~ (Done)

- Sentence mode now extracts inflected→lemma mappings from the AI's word-by-word analysis
- `inflectedForm` is set correctly for sentence mode (via word-by-word parsing), focused words mode (via lemma comparison), and single word mode (via extraction lemma comparison)
- Card preview and Anki card both highlight the inflected form in the example sentence

## Medium Priority

### Disambiguation support

- The original skill has `eng-disambig` and `bangla-disambig` fields for homonyms
- Could add these to card extraction when the word is ambiguous (e.g. তারা = star vs they)

### Root word suggestions

- When defining a derived word, offer to also create a card for the root
- e.g. আদুরে (cute) -> also offer আদর (affection)
- The prompt mentions roots but the UI doesn't surface them as separate card candidates

### Unmarked sentence mode

- Paste a sentence without highlighting any words -> auto-detect which words are NOT in Anki and offer cards for those
- The original skill describes this workflow but it's not implemented yet
- Would need to: tokenize sentence, lemmatize each word, batch-check Anki, filter to unknown words

### ~~Anki sync button~~ (Done)

- Sync button (refresh icon) in header, visible on all screen sizes when Anki is connected
- Triggers AnkiConnect sync so cards added on laptop appear on phone

### ~~Pending queue sync~~ (Done)

- "Sync All" button in pending queue banner, visible when Anki is connected
- Shows progress during sync ("Syncing 3/7..."), then summary ("5 synced, 1 failed")
- Failed items stay in the pending queue for retry
- Summary auto-dismisses after 5 seconds

### Cache prompt files in production

- `reloadPrompts()` is called on every `/api/prompts/preview` request for live editing
- For normal usage, prompts should be loaded once at startup (no disk reads per request)
- Either use an env check (`NODE_ENV`) or only reload in the preview endpoint

## Lower Priority

### Cloze card support

- The original skill supports "Cloze+" note type for grammar practice
- Could add a toggle per card preview: "Make cloze instead"

### Web search verification

- For uncommon words, verify definitions via Samsad dictionary or Wiktionary
- The original skill mentions this but it requires web search capability

### Better vocabulary extraction from sentences

- Current regex parsing of `**Vocabulary:**` line is fragile
- Could use structured output for the main AI response too (not just card extraction)
- Or use a more robust parser

### Mobile/offline experience

- Better queue management UI (show all queued cards, bulk actions)
- Export queue as JSON for transfer between devices
- Import queue from JSON

### History and search

- Search through past conversations
- Filter by words looked up
- Stats on words learned over time
