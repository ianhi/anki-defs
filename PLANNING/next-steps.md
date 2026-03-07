# Next Steps

## High Priority

### Test the new prompts end-to-end
- Submit various sentences and single words to verify the improved prompts produce correct lemmatization, clean definitions, and real example sentences
- Specifically test: verb forms (কাঁদতে, যাচ্ছে, গেছে), noun case endings (বাজারে, বাজারের), adjectives
- Verify the lemma mismatch badge appears when it should and not when it shouldn't

### Card field mapping
- Current code sends `{Word, Definition, Example, Translation}` to Anki
- The original skill uses `{Bangla, Eng_trans, example sentence, sentence-trans}` for the "Bangla (and reversed)" note type
- Need to verify which field names the user's actual Anki note type expects, or make field mapping configurable

### Sentence mode: use original sentence as example
- When a word comes from a sentence the user typed, we use that sentence as the example — but the card should highlight (bold) the word as it appeared in the sentence, not the lemmatized form
- Verify `inflectedForm` is being set correctly in all cases (sentence mode, focused words mode, single word mode)

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

### Pending queue sync
- When Anki comes back online, offer to sync all queued cards
- Currently cards are queued but there's no "sync all" button

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
