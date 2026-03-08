# Plan: JSON-First Card Pipeline

**Status**: Done (web). Android and Anki add-on need migration.

## What Changed (Web)

The web stack now uses a single non-streaming LLM call that returns JSON directly,
replacing the old two-step markdown streaming + extraction pipeline.

- One LLM call → JSON object/array → card previews
- No `text` SSE events — client shows spinner until `card_preview` events arrive
- Server-side spelling correction via `applySpellingCorrection()`
- `CardPreview` fields: `word`, `definition`, `banglaDefinition`, `exampleSentence`,
  `sentenceTranslation`, `alreadyExists`, `existingCard?`, `spellingCorrection?`
- Removed: `inflectedForm`, `lemmaMismatch`, `originalLemma`, `rootWord`

Key files: `DOCS/card-pipeline.md` has the full implementation reference.

## Migration Checklist: Android & Anki Add-on

Both backends still use the old two-call pipeline. To migrate each:

1. **Prompts already updated** — `shared/prompts/` has JSON-format templates.
   Backends loading from shared will get new prompts on rebuild.

2. **Add non-streaming JSON completion** — Each backend needs a function that
   calls the LLM and returns parsed JSON (not streamed markdown).

3. **Add JSON parse with fault tolerance** — Strip code fences, `JSON.parse()`,
   retry with healing prompt on failure.

4. **Add `buildCardPreviews()` equivalent** — Check each card's word against Anki,
   set `alreadyExists`, apply spelling corrections.

5. **Remove old extraction code** — Delete `extractCardData()`,
   `extractCardDataFromSentence()`, markdown parsing, `text` SSE events.

6. **Add `banglaDefinition` field** — Throughout card creation, storage, and display.

7. **Block sentence without highlights** — Return error SSE event if input has
   multiple words but no highlighted words.

8. **Update SSE contract** — Only emit: `usage`, `card_preview` (per card), `done`.
   No more `text` events.

9. **`card-extraction.json` is deleted** — Remove any references to it.
