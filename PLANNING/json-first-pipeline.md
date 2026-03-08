# Plan: JSON-First Card Pipeline

**Status**: Done (web stack). Android and Anki add-on need migration.
**Goal**: Replace the two-step markdown→extraction pipeline with a single LLM call that returns JSON directly.

## Migration Needed: Android & Anki Add-on

Both other backends still implement the old two-call pipeline. To migrate:

1. **Prompt changes already landed** — `shared/prompts/` files are updated; backends that
   load from shared will get new prompts automatically on rebuild
2. **API contract changed** — `SSEEvent` no longer has `type: 'text'`; `CardPreview` lost
   `inflectedForm`/`lemmaMismatch`/`originalLemma` and gained `rootWord?`/`spellingCorrection?`
3. **Each backend needs**: non-streaming JSON completion function, JSON parse with fault
   tolerance, `buildCardPreviews()` equivalent, removal of old extraction/streaming code
4. **Sentence mode without highlights** should return an error (blocked in client UI)
5. **card-extraction.json deleted** — backends referencing it will fail on startup

## Current Flow (Two LLM Calls)

1. User submits word/sentence
2. **LLM call #1** → streaming markdown response (definition, examples, word-by-word analysis)
3. Client displays markdown as chat-style response
4. **LLM call #2** → card-extraction prompt parses the markdown into structured JSON per card
5. Client renders card previews from JSON

Problems:

- Two LLM calls per request (slow, expensive)
- Second call can misinterpret the first call's output
- Markdown response is mostly redundant — card preview already shows everything the user needs
- Complex SSE event pipeline (content → card → done) with parsing/extraction orchestration

## Proposed Flow (One LLM Call)

1. User submits word/sentence
2. **One LLM call** → JSON array of card objects
3. Client renders card previews directly

No markdown, no streaming text, no extraction step.

## JSON Response Schema

```typescript
// Single word mode: one card
// Sentence mode (future): array of cards for unknown words
// Focused words mode: one card per highlighted word

interface CardResponse {
  word: string; // lemmatized dictionary form → becomes the Anki "word" field
  definition: string; // concise English, under 10 words
  exampleSentence: string; // real Bangla sentence, target word bolded with **
  sentenceTranslation: string; // English translation
  rootWord?: string; // if derived from a root: "আদর — affection" → becomes the Anki "word" field instead
  spellingCorrection?: string; // if input was a typo: "বাজারে → বাজার" — surfaced in UI
}
```

For sentence/focused modes where the user provides the sentence:

- `exampleSentence` = the user's original sentence
- `sentenceTranslation` = LLM's translation of that sentence
- No AI-generated example sentences

## Prompt Changes

### Single word prompt

- Output format changes from markdown template to JSON schema description
- Same rules (lemmatization, spelling tolerance, etc.) still apply
- Example sentences still required (LLM generates them)

### Focused words prompt

- Returns array of CardResponse objects
- `exampleSentence` is always the user's input sentence
- Still needs to explain inflected→lemma relationship (for the inflectedForm field used in bolding)
- Add `inflectedForm` field to schema so the LLM reports which form appears in the sentence

### Sentence mode (no highlights)

- **Disallow for now** — if input has multiple words but none focused, block submission in the client
- Future work: Anki-aware word filtering to auto-detect unknown words, then treat as focused-words

### Card extraction prompt

- **Deleted** — no longer needed

## Server Changes

### `ankiconnect-server/src/routes/chat.ts`

- Remove streaming SSE for card content (no more `content` events with markdown chunks)
- For JSON response: either use structured output (Gemini) or parse JSON from text response
- Still use SSE for progress indication? Or switch to simple request/response?
- Card events sent directly from LLM response, no extraction step

### `ankiconnect-server/src/services/cardExtraction.ts`

- Remove `extractCardDataFromResponse()` and `extractCardDataFromSentence()`
- Keep `extractInflectedForms()` only if we still need it (the LLM could report inflected forms directly)
- Keep Anki duplicate checking logic

### `ankiconnect-server/src/services/gemini.ts`

- Use `responseSchema` for structured output when provider is Gemini
- For Claude/OpenRouter: parse JSON from text response with fallback

### `ankiconnect-server/src/services/ai.ts`

- Remove `extractCard` from prompt templates
- Simplify `getSystemPrompts()` — fewer prompt types needed

## Client Changes

### `client/src/components/ChatInterface.tsx` / streaming logic

- Remove markdown streaming display (no more chat bubbles with AI response)
- Show a loading state while waiting for JSON response
- Render card previews directly from response

### `client/src/components/CardPreview.tsx`

- Mostly unchanged — already renders from card data
- May need to handle new fields (partOfSpeech, rootWord, spellingCorrection)

## Migration Strategy

1. **Start with single-word mode** — simplest case, one card, no sentence context
2. **Then focused-words mode** — array of cards, user-provided sentence
3. **Sentence mode last** — needs Anki word filtering (separate project)
4. Keep old markdown flow available behind a flag during transition
5. Update Android and Anki add-on backends after web is stable

## Decisions

- **Streaming UX**: Spinner with a small processing status message (e.g., "Looking up বাজার..."). No need for incremental streaming.
- **Structured output**: Use Gemini's native `responseSchema` for guaranteed JSON. For Claude/OpenRouter, prompt for JSON and parse — be fault-tolerant. If JSON is malformed, try a short follow-up "healing" prompt to fix it.
- **Retry with context**: Same `userContext` mechanism works — append to user message.
- **Bolding / inflected forms**: No extraction needed for sentence modes — we already know which words the user highlighted, so we bold those directly (wrap in `**`). If multiple focused words, require the LLM to define them in the same order they were highlighted, then zip the responses with the highlight list. For single-word mode, the LLM bolds the word inline in the example sentence using `**` markers (e.g., `"মেয়েটা **কাঁদছে**।"`). Client converts `**` to `<b>` tags for Anki. This eliminates `extractInflectedForms()` and `boldWordInSentence()` entirely.

## Files Affected

| File                                                | Change                        |
| --------------------------------------------------- | ----------------------------- |
| `shared/prompts/single-word.json`                   | New JSON-output format        |
| `shared/prompts/focused-words.json`                 | New JSON-output format        |
| `shared/prompts/sentence.json`                      | Keep for now (future work)    |
| `shared/prompts/card-extraction.json`               | Delete                        |
| `shared/prompts/variables.json`                     | May simplify                  |
| `shared/types.ts`                                   | Add `CardResponse` type       |
| `ankiconnect-server/src/routes/chat.ts`             | Simplify pipeline             |
| `ankiconnect-server/src/services/cardExtraction.ts` | Remove extraction, keep dedup |
| `ankiconnect-server/src/services/gemini.ts`         | Add structured output         |
| `ankiconnect-server/src/services/ai.ts`             | Remove extractCard prompt     |
| `client/src/components/ChatInterface.tsx`           | Remove markdown display       |
| `client/src/lib/api.ts`                             | Simplify SSE handling         |
| Android + Anki add-on backends                      | Update after web is stable    |
