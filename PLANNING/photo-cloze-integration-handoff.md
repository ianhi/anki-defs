# Photo Cloze — Integration Handoff

This branch (`feat/cloze-from-textbook`) adds a photo-to-cloze-card pipeline
that mirrors the existing photo-to-vocab flow. **Backend + shared types + client
API wrapper are done and tested. The UI is not built yet.** This doc is the
handoff for whoever finishes the merge.

The design lives in [photo-cloze.md](photo-cloze.md). This doc is a status
snapshot + gotchas.

## Status matrix

| Layer                                                     | Status                                                                                   | Files                                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| Vision prompt (transcribe)                                | ✅ done                                                                                  | `shared/prompts/photo-cloze-transcribe.json` |
| Text prompt (extract)                                     | ✅ done                                                                                  | `shared/prompts/photo-cloze-extract.json`    |
| Per-language cloze rules                                  | ✅ done (es-MX, bn-IN, ta-IN)                                                            | `shared/languages/*.json`                    |
| Shared TypeScript types                                   | ✅ done                                                                                  | `shared/types.ts`                            |
| Python AI service functions                               | ✅ done                                                                                  | `python-server/anki_defs/services/ai.py`     |
| Gemini provider (vision text)                             | ✅ done                                                                                  | `.../services/providers/gemini.py`           |
| JSON healing helper                                       | ✅ done                                                                                  | `.../services/routes/_helpers.py`            |
| Routes (`/cloze-transcribe`, `/cloze-extract`)            | ✅ done                                                                                  | `.../services/routes/photo.py`               |
| Client API methods                                        | ✅ done                                                                                  | `client/src/lib/api.ts`                      |
| **Client UI (transcribe step, review step, mode toggle)** | ❌ **not done**                                                                          | `client/src/components/photo/*`              |
| Addon parity                                              | ⚠️ shared prompts + ai.py changes will propagate via build-time copy; verify             | `anki-addon/`                                |
| Android parity                                            | ⚠️ untouched; Android photo flow likely needs matching update if we want cloze on mobile | `android/`                                   |

The pipeline was evaluated against the textbook's own answer key on four
progressively harder exercises. **50/53 exact matches on uniquely-determined
answers, with all 5 genuinely ambiguous cases correctly flagged `low`
confidence.** See "Test results" below.

---

## Architecture

Two-stage pipeline, mirrored on the existing vocab flow:

```
         image            transcription (editable)    items
      ┌────────┐        ┌──────────────────────┐    ┌─────────────────────┐
user →│ camera │──────→ │ cloze-transcribe     │ → │ cloze-extract       │ → review UI → createNote
      └────────┘   SSE  │ Gemini vision → text │   │ Gemini text → JSON  │    (existing
                        └──────────────────────┘   └─────────────────────┘     card type)
```

**Why two stages instead of one vision-to-JSON call:**

- Debuggable: user sees the transcription; can correct OCR before the AI
  commits to a conjugation.
- Cheaper: stage 2 is text-only, no image tokens.
- Separable failure modes: OCR errors vs. conjugation errors.
- Matches existing `photo-extract` → `photo-generate` pattern; review UI for
  the intermediate artifact is a natural fit.

**Why transcription is plain text, not structured JSON:**

- The transcription is user-editable; a textarea is simpler than a structured
  editor.
- Headings / instructions / word banks are carried in the text for the extract
  prompt's internal reasoning but are NOT returned in the final JSON schema
  (they don't belong on cards — see design commentary below).

---

## Shared types (contract)

```ts
interface PhotoClozeTranscribeResponse {
  transcription: string;
  usage?: TokenUsage;
}

type ClozeBlankCategory =
  | 'verb'
  | 'noun'
  | 'preposition'
  | 'article'
  | 'pronoun'
  | 'conjunction'
  | 'other';

interface ClozeBlank {
  answer: string; // may be multi-word (e.g. "va a firmar")
  hint: string | null; // verbatim from source, or AI-generated cue, or null
  category: ClozeBlankCategory;
}

interface ClozeItem {
  itemNumber: number | null; // preserved from textbook numbering
  sentence: string; // with __1__, __2__, ... markers per blank
  blanks: ClozeBlank[]; // positional, left-to-right
  translation: string;
  confidence: 'high' | 'low';
  contextPreamble: string | null; // story/letter lead-in, else null
}

interface PhotoClozeExtractResponse {
  items: ClozeItem[];
  unsupported?: string[]; // items AI skipped as open-ended or un-clozeable
  usage?: TokenUsage;
}
```

### Design choices to be aware of

- **No `hintSource` discriminator.** We briefly had `'source' | 'generated' | 'none'`. Removed — `hint === null` already says "no hint". If the review UI later wants to flag AI-generated hints visually, reintroduce a single boolean `hintGenerated` (don't re-add the three-state enum).
- **No `exerciseTitle` / `instructions` / `wordBank` in the response.** These are read by the extract prompt internally for conjugation cues but are not surfaced — they don't belong on the final card. If the review UI wants to show them to the user (e.g. to ground their sanity check), pipe them through explicitly.
- **Sentence markers are `__1__`, `__2__`, ...** Double underscore, one-based. When building the Anki cloze field, replace `__N__` with `{{cN::answer::hint}}` (or `{{cN::answer}}` if `hint` is null).
- **Hints are verbatim from source, including parentheses.** Textbook printed `(firmar)` → `hint: "(firmar)"`. When rendering as `{{cN::answer::hint}}` the parens will show on the card. **The UI/card-builder may want to strip the wrapping parens** — decide during UI work.
- **`__1__ __2__` separated only by a space is 2 distinct blanks.** The extract prompt enforces this because scanned textbook underscores can render as adjacent runs.

---

## Per-language extension point: `clozeExtractionRules`

The extract prompt has a `{{clozeExtractionRules}}` slot, substituted per
language by `python-server/anki_defs/services/ai.py::_render_prompt`. Each
language file can define `clozeExtractionRules` with language-specific
textbook conventions.

Already populated: **es-MX, bn-IN, ta-IN**. Covers register enforcement,
tense-heading overrides, case suffix handling, clitic attachment (Spanish),
subjunctive triggers (Spanish), script rules.

**If adding a new language**, consider including:

- Register/formality rules (how pronouns in the sentence constrain verb forms).
- Which grammatical forms the heading should force onto verb blanks.
- Hint-generation preference (dictionary form, script, etc.).
- Any textbook conventions specific to that language's pedagogical tradition.

---

## Backend endpoints

Both are mounted by `python-server/anki_defs/services/routes/photo.py` — the
same file as the vocab photo routes. Behavior matches existing patterns
(FormData image upload, dev-image save, `compute_cost` + `session.record_usage`
accounting, `format_http_error` on HTTP failures).

### `POST /api/photo/cloze-transcribe`

- **Request**: multipart FormData with `image` (Blob)
- **Response**: `PhotoClozeTranscribeResponse`
- **Error**: 400 if image missing, 500 on Gemini failure
- **Notes**:
  - Vision call, Gemini-only (same constraint as vocab extract).
  - Saves uploaded image to `dev-images/` when `ANKI_DEFS_DEV` env var is set.
  - Reloads prompts from disk on every request in dev mode.
  - No deck parameter — transcription is language-agnostic.

### `POST /api/photo/cloze-extract`

- **Request**: JSON `{ transcription: string, deck?: string }`
- **Response**: `PhotoClozeExtractResponse`
- **Error**: 400 if transcription empty, 500 on parse failure after healing retry
- **Notes**:
  - Text-only call (no image). Uses the current `aiProvider` — Gemini/Claude/OpenRouter all work.
  - Deck determines language via `get_language_for_deck()` (hierarchy walk + fallback).
  - Wrapped with `parse_json_with_healing()` — one retry via a healing prompt if JSON is malformed. This was added after early tests showed Gemini occasionally emits stray commas in dense outputs.
  - Single-shot (no chunking). Do not add chunking — the AI needs full-page context for register consistency, tense headings, and narrative preambles.

### Shared helpers landed in `_helpers.py`

- `parse_json_with_healing(raw, usage_cb)` — new, generic JSON parse + retry. Returns `Any`.
- `parse_cards_with_healing(raw, usage_cb)` — refactored to use `parse_json_with_healing`.

---

## Client API methods

In `client/src/lib/api.ts`:

```ts
photoApi.clozeTranscribe(blob): Promise<PhotoClozeTranscribeResponse>
photoApi.clozeExtract(transcription: string, deck?: string): Promise<PhotoClozeExtractResponse>
```

Both match existing `photoApi.*` patterns: FormData for images, `fetchJson`
for text. No SSE — both endpoints are single-shot.

---

## What's left: the UI (task #7)

**Mode toggle in PhotoCapture.tsx**: vocab list vs. fill-in-blank. Reuse the
existing state machine shell; branch on mode between the existing
`ExtractStep` / `GenerateStep` and new `ClozeTranscribeStep` /
`ClozeReviewStep`.

### Suggested components

- **`ClozeTranscribeStep.tsx`** — after upload:
  1. Calls `photoApi.clozeTranscribe(blob)`.
  2. Shows the transcription in a large editable textarea (user fixes OCR).
  3. Shows the `# Items transcribed: N of N` trailer separately for confidence signal.
  4. "Continue" button → calls `photoApi.clozeExtract(transcription, deck)`.
  5. Shows token usage / cost, matching the existing extract step.

- **`ClozeReviewStep.tsx`** — after extract:
  1. Renders each `ClozeItem` as a card preview row.
  2. Sentence shown with `__N__` replaced by editable inputs pre-filled with each blank's answer.
  3. Hint shown as a muted label next to each input (user can edit).
  4. `confidence: 'low'` items visually flagged (border or icon) for user attention.
  5. `unsupported[]` listed separately as "skipped items" (user can discard silently or re-add).
  6. Discard control per item (already planned per user feedback).
  7. "Add all" button builds the Anki cloze field and calls `createNote({ cardType: 'cloze', ... })` using the existing endpoint.

### Building the cloze field for `createNote`

Given a `ClozeItem`, assemble `Text` for the cloze note type:

```ts
function buildClozeText(item: ClozeItem): string {
  let text = item.sentence;
  item.blanks.forEach((b, i) => {
    const n = i + 1;
    // Strip wrapping parens on verbatim hints like "(firmar)" → "firmar".
    const hint = b.hint?.replace(/^\((.+)\)$/, '$1') ?? null;
    const cloze = hint ? `{{c${n}::${b.answer}::${hint}}}` : `{{c${n}::${b.answer}}}`;
    text = text.replace(`__${n}__`, cloze);
  });
  return text;
}
```

The existing cloze note type (`shared/data/note-types.json`) has fields
`Text`, `English`, `FullSentence`, `Tense`, `Image`, `FullSentenceAudio`,
`ShowEnglish`. Populate `Text`, `English` (= `item.translation`), and
`FullSentence` (= `item.sentence` with `__N__` replaced by each blank's
`answer`). Leave audio/image empty for v1. `Tense` is not in our response
schema — omit, or derive from `category` if someone wants it later.

`CreateNoteRequest` already supports `cardType: 'cloze'`. The server maps
`word` / `definition` / `nativeDefinition` / `example` / `translation` into
the cloze note type's fields. You may need to add additional fields to
`CreateNoteRequest` (e.g. `clozeText`, `fullSentence`) if the existing
vocab-shaped payload doesn't fit cleanly — confirm by reading
`python-server/anki_defs/services/routes/anki.py` for the field map.

### Reuse these (don't reinvent)

- `useImageInput.ts` for drag/drop + MIME validation
- Image compression + FormData upload pattern from `UploadStep.tsx`
- Token-usage display pattern from existing vocab flow
- `CardPreview.tsx` — cloze support already renders in the existing grid if
  you pass a suitable `CardPreview` shape; may need a small extension for the
  per-blank edit UI

### Things NOT to add

- No chunking on extract (explained above).
- No new note-type creation — the cloze note type already exists and auto-migrates.
- No new SSE infrastructure — both new endpoints are single-shot.
- No duplicate FormData helper — we have two call sites; extract if a third appears.

---

## Test results on difficult exercises

Scored against the textbook's own answer key
(_Complete Spanish Step-by-Step_, Bregstein). Test images live in
`~/dev/cloze-test-pics/` and are also served from `dev-images/` in this
worktree.

| Exercise                                     | Stress dimension                         | Exact   | Low-confidence flags                | Notes                                                       |
| -------------------------------------------- | ---------------------------------------- | ------- | ----------------------------------- | ----------------------------------------------------------- |
| Ex 5.1 (word-bank, regular verbs)            | word-bank, no per-blank hints            | 15/15   | #4, #14 (multiple bank entries fit) |                                                             |
| Ex 7.7 (mixed inf/conjugated)                | word-bank, multi-blank, mixed forms      | 12/13\* | #13 (OCR-fused blanks)              | \*Image shows only items 1-13; 14-15 are on the facing page |
| Ex 13.4 (subjunctive vs indicative)          | mood selection, Spanish-infinitive hints | 10/10   | #10 (no crees que → rhetorical)     |                                                             |
| Ex 14.3 (irregular preterite, 2-blank items) | irregular stems, multi-blank             | 13/14   | #3 (`dar` vs `darte` clitic)        |                                                             |

**Total: 50/53 exact on uniquely-determined answers. 5 genuinely ambiguous
cases were correctly flagged `low` and none were misflagged `high`.**

### Known edge cases (prompts handle them; worth knowing)

- **Adjacent exercise content.** If the photograph includes the tail of one
  exercise and the start of another, the AI extracts items from both. The
  extract response will have items with `itemNumber: null` from the secondary
  exercise. The UI's discard control handles this; you may also want to offer
  a "keep only exercise with most items" heuristic.
- **OCR underscore fusion.** Two adjacent blanks in print (`___ ___` separated
  by a space) can OCR as one long gap. The transcribe prompt explicitly
  instructs "one `_____` per visual blank"; the extract prompt counts each
  `_____` as its own blank. Still fails occasionally — the low-confidence flag
  is the safety net.
- **Open-ended items.** Prompts like "answer in Spanish" are correctly flagged
  into `unsupported` rather than forced into cloze shapes.

---

## Files changed

```
shared/prompts/photo-cloze-transcribe.json   (new)
shared/prompts/photo-cloze-extract.json      (new)
shared/languages/es-MX.json                  (+ clozeExtractionRules)
shared/languages/bn-IN.json                  (+ clozeExtractionRules)
shared/languages/ta-IN.json                  (+ clozeExtractionRules)
shared/types.ts                              (+ cloze types)
python-server/anki_defs/services/ai.py       (+ get_cloze_transcription,
                                                 build_cloze_extract_prompt,
                                                 clozeExtractionRules render slot)
python-server/anki_defs/services/providers/gemini.py
                                             (_post_vision helper,
                                              get_vision_text_completion,
                                              maxOutputTokens bumped to 16384)
python-server/anki_defs/services/routes/photo.py
                                             (+ /cloze-transcribe, /cloze-extract)
python-server/anki_defs/services/routes/_helpers.py
                                             (+ parse_json_with_healing,
                                              refactored parse_cards_with_healing)
client/src/lib/api.ts                        (+ photoApi.clozeTranscribe,
                                              photoApi.clozeExtract)
PLANNING/photo-cloze.md                      (still the design doc)
PLANNING/photo-cloze-integration-handoff.md  (this file)
PLANNING/INDEX.md                            (status update)
```

## Cross-platform follow-ups

- **Anki addon**: `ai.py` and `routes/photo.py` are copied into the addon at
  build time (per memory notes). Run the addon's test suite after merge;
  `tests/test_shared_data.py` references the language-file shape and may want
  a fixture update for the new `clozeExtractionRules` field (present but
  optional).
- **Android**: the NanoHTTPd server doesn't have these routes. If we want
  cloze on mobile, add matching route handlers in Kotlin. Not blocking; the
  web flow works first.

## Acceptance checklist for the integration PR

- [x] UI: mode toggle + transcribe step + review step
- [x] UI: low-confidence visual flag (border, icon, or column)
- [x] UI: per-item discard control
- [x] UI: editable hint + answer + translation per blank
- [x] `createNote` builds `{{cN::answer::hint}}` correctly (parens stripped — see snippet above)
- [ ] Duplicate-check behavior for cloze cards (the `Text` field is the natural key; confirm behavior in `anki.py`)
- [ ] Addon `tests/test_shared_data.py` still passes
- [x] `npm run check` + `npm run check:py` green
- [x] Doc updates: `client/DOCS/file-map.md` for new components; `shared/DOCS/types-reference.md` for new types; `DOCS/api-contract.md` for the two new endpoints; `PLANNING/INDEX.md` status bump.
- [ ] **E2E test with real exercise photo** (never done — see agent prompt below)

## E2E Test Agent Prompt

```
Test the photo-to-cloze flow end-to-end. Test images are in
~/dev/cloze-test-pics/. Start the dev servers (npm run dev), open the
UI, toggle to "Fill-in-blank" mode, upload an exercise photo, verify
the transcribe → edit → extract → review → add-to-Anki flow works.

Read PLANNING/photo-cloze-integration-handoff.md for the full context,
acceptance checklist, and test expectations (50/53 exact matches on
answer key from the backend tests).

The UI was built but never tested with a real image as of 2026-04-20.
Components: ClozeTranscribeStep.tsx, ClozeReviewStep.tsx, mode toggle
in PhotoCapture.tsx.

Remaining unchecked items from the acceptance checklist:
- Duplicate-check behavior for cloze cards
- Addon tests still pass
- Real e2e test with exercise photos
```
