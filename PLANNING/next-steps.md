# Next Steps

## High Priority

### Test and polish Anki add-on

- Code is hardened but never verified end-to-end inside Anki Desktop
- Run `install-dev.sh` as ian, restart Anki, test all flows:
  card creation, search, deletion, SSE streaming, settings/keyring, cloze
- Rebuild frontend into addon after all recent UI changes

### Sentence translation without word highlighting

- Currently entering a sentence without highlights shows a help message
- Should allow: just translate the sentence naturally
- Use case: "what does this sentence mean?" without wanting flashcards
- Implementation: add a `translate` mode to the AI pipeline

### Reader mode (tap-to-define)

- Paste a large block of text, tap any word for instant definition
- Option to add tapped words as flashcards
- Needs careful UI planning — user wants significant input on approach
- PDF/image import builds on this (Gemini vision for OCR)

### Embedded audio in cards

- Generate TTS audio at card creation time, embed in Anki notes
- See `PLANNING/audio-in-cards.md` for full plan
- Google Cloud TTS recommended (~$0.02 per 1K words)

### Language-agnostic prompts

- All prompt templates are hardcoded to Bangla ("You are a Bangla language expert")
- Types have `banglaDefinition`, `englishToBanglaPrefix`, `english-to-bangla` mode
- To support other languages: parameterize prompts with target language,
  rename fields to generic names (nativeDefinition, etc.)
- Big refactor — needs careful planning

## Medium Priority

### Error UX polish

- Wire up `useErrorModal.showError()` for non-recoverable errors
- ErrorModal component and store exist but nothing triggers showError() yet

### Unmarked sentence mode (auto-detect unknown words)

- Paste a sentence → auto-detect which words are NOT in Anki
- Tokenize, lemmatize, batch-check Anki, filter to unknown
- Different from sentence translation — this generates cards for unknown words

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

### Bangla disambiguation support

- `eng-disambig` and `bangla-disambig` fields for homonyms

## Recently Completed

- Cloze card support (types, settings, UI checkboxes, distractor backend)
- TTS with voice picker (browser SpeechSynthesis, bn-IN)
- Theming (light/dark/system toggle, soft dark palette)
- Layout shift fixes (pre-read state, useLayoutEffect, fixed header)
- Onboarding flow (3-step wizard)
- Error messages in assistant bubbles
- Settings modal with tabs
- Structured logging (Python + frontend)
- Settings unification (shared settings_base.py)
- Duplicate card fix (allowDuplicate: true)
- Tap example sentence to populate input
- Input draft persistence
