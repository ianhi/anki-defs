# Next Steps

## Bugs (fix first)

### Duplicate word with new definition fails to add

- When a word already has a card but the user wants a second card with a different
  definition (e.g. a different sense), the add fails
- The duplicate check should warn but allow adding — currently it seems to block
- Investigate: is the error from the `alreadyExists` check or from Anki itself?

### Mobile refresh/relayout delays

- Reopening the tab on phone causes visible relayout and refresh delays
- Partially addressed (draft persistence, HMR timeout increase) but still noticeable
- May be related to TanStack Query revalidation on tab focus (disabled globally but
  individual queries may override), or Zustand rehydration
- Need to profile: is it a full reload or just re-renders?

## High Priority Features

### Reader mode (tap-to-define)

- Paste a large block of text (article, story, dialogue)
- Tap any word to get an instant definition popup
- Option to add tapped words as flashcards
- This is the primary "study from real content" workflow
- Could be a separate route/view (`/reader`) or a modal

### PDF/image import into reader

- Import PDFs or photos of text (textbook pages, signs, menus)
- Run OCR/transcription to extract text (see `../transchrive` project prompts)
- Feed extracted text into the reader mode
- Gemini has built-in vision capabilities — could send images directly

### Text-to-speech

- Play pronunciation for single words (most valuable use case)
- Options: browser SpeechSynthesis API (free, offline), Google TTS, or device voices
- Add a speaker icon on card previews next to the word
- Language detection: use the target language for TTS voice selection

### Sentence translation without word highlighting

- Currently blocked: entering a sentence without highlights returns an error
- Should allow: just translate the sentence naturally without generating cards
- Use case: "what does this sentence mean?" without wanting flashcards
- Implementation: add a `translate` mode or unblock `sentence-blocked`

### Cloze card support (Phase 3 — backend)

- Frontend checkboxes + field builders done (committed)
- Still needed: `/api/chat/distractors` endpoint + distractor prompt template
- Validation pipeline: overgenerate 5 → validate → select best 3
- See `PLANNING/cloze-research-prompt.md` for research findings

### Test and polish Anki add-on

- Code is hardened but never verified end-to-end inside Anki Desktop
- Run `install-dev.sh` as ian, restart Anki, test all flows
- Rebuild frontend into addon after UI changes

## Already Implemented (verify these work)

### Edit word/definition before adding ✓

- Pencil icon on card preview lets you edit word and definition
- Relemmatize button asks AI for correct dictionary form
- Already in `CardPreview.tsx` — verify it works on mobile

### Tap example sentence to populate input ✓

- Clicking the Bangla definition text populates the input area
- Uses `CustomEvent('setInput')` in `CardPreview.tsx` line 375
- Verify: does tapping the EXAMPLE SENTENCE also work? (currently only
  the Bangla definition is clickable — may want to add example sentence too)

## Medium Priority

### Theming

- Currently dark mode only
- Add light/dark/system toggle in Settings > Preferences
- Respect `prefers-color-scheme` for system default

### Error UX polish

- Errors show in assistant bubbles (done)
- Wire up `useErrorModal.showError()` for non-recoverable errors
- ErrorModal component exists but nothing triggers it yet

### Unmarked sentence mode (auto-detect unknown words)

- Paste a sentence → auto-detect which words are NOT in Anki
- Tokenize, lemmatize, batch-check Anki, filter to unknown
- Different from "sentence translation" — this generates cards for unknown words

### Per-message streaming indicator

- With concurrent streaming, loading indicator only shows on last message
- Should show on any assistant message still loading

### Migrate Android to JSON-first pipeline

- Still uses old two-call streaming markdown + extraction
- Should match web: single non-streaming LLM call returning JSON

## Lower Priority

### Gemini grounding with web search

- `google_search` tool for grounded responses
- $35/1K grounded requests — opt-in only
- Could verify definitions, find real example sentences

### Bangla disambiguation support

- `eng-disambig` and `bangla-disambig` fields for homonyms
- e.g. তারা = star vs they

### Web search verification

- Verify definitions via Samsad dictionary or Wiktionary
