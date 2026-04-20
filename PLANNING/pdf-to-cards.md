# PDF to Cards — Extract Definitions from Textbook PDFs

## Context

Users have digital textbook PDFs (e.g. _Complete Spanish Step-by-Step_, 621 pp)
with selectable text. They want to turn vocab lists, conjugation tables, and
reading passages into Anki cards without flipping through hundreds of pages.

The photo-to-flashcards flow already covers scanned / handwritten input via
vision AI. PDFs with selectable text are different: no OCR needed, much larger
volume, and the structure (headings, chapters, exercise numbers) is machine
readable. That structure is the key asset — we use it to let an AI scout the
book and surface the parts worth extracting.

## Reference PDF

`Complete-Spanish-Step-By-Step-Book.pdf` — 621 pp, digital (InDesign), excellent
extraction. Contains vocab lists (`Key Vocabulary / Los colores`), conjugation
tables, reading passages (_El tren_), fill-in exercises (`K Exercise 6.3`),
grammar prose, and an answer key (pp. 579+, extractor must exclude by default).
Layout hazards: 2-column grids, `1.\t` numbered list markers, running
header/footer on every page, U+00AD soft hyphens at line breaks.

## Architecture

### Pipeline

```
┌────────────────────────────────────────────────────────┐
│  CLIENT (pdfjs, runs in browser)                       │
│                                                        │
│  1. Upload PDF                                         │
│  2. Extract outline locally (free):                    │
│     - pdfjs getOutline() for embedded bookmarks        │
│     - heading heuristics (font size, bold, patterns    │
│       like "Exercise X.Y", "Key Vocabulary")           │
│     - column-aware text per page (y-coord grouping)    │
│     - preprocess: strip headers/footers, U+00AD,       │
│       `1.\\t` markers                                  │
│  3. Build section list: {heading, pageRange, body3ln}  │
└────────────────────────────────────────────────────────┘
                         │
                         ▼ POST /api/pdf/scout
┌────────────────────────────────────────────────────────┐
│  SERVER — AI scout pass (one call, Gemini Flash)       │
│                                                        │
│  Classify each section + link related sections:        │
│    contentType: vocab | passage | glossary |           │
│                 exercise | prose                       │
│    suggestedTags: ["colors", "ch2", …]                 │
│    worthExtracting: bool                               │
│    confidence: 0–1                                     │
│    relatedTo: [sectionId, …]  ← pairing info           │
└────────────────────────────────────────────────────────┘
                         │
                         ▼ scouted TOC
┌────────────────────────────────────────────────────────┐
│  CLIENT — Scout review UI (spot check #1)              │
│                                                        │
│  Checkbox list; user deselects, edits tags, picks      │
│  extra tag like `pdf:complete-spanish`. User can       │
│  also add/remove `relatedTo` links (drag or dropdown). │
└────────────────────────────────────────────────────────┘
                         │
                         ▼ POST /api/pdf/extract (per section)
┌────────────────────────────────────────────────────────┐
│  SERVER — Extract pass                                 │
│                                                        │
│  Pick prompt by contentType. If the section has        │
│  relatedTo, fetch text for linked sections and pass    │
│  them as supporting context to the prompt:             │
│    vocab    → pdf-vocab-extract.json                   │
│    passage  → pdf-passage-extract.json (w/ glossary)   │
│    exercise → pdf-cloze-extract.json   (cloze agent)   │
│  Stream card previews (SSE), tags attached.            │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│  CLIENT — CardPreview flow (spot check #2, existing)   │
│                                                        │
│  Each card shown with edit/reject. addNote carries     │
│  tags through to Anki.                                 │
└────────────────────────────────────────────────────────┘
```

Two human review gates: scout-level (which sections) and card-level (which
cards). Handles the "621 pages is tiring" problem without removing control.

### Why client-side pdfjs

- **Most mature option.** pdfjs is Mozilla's engine, battle-tested in Firefox
  for a decade. `pypdf` is fine for basic text but mediocre on multi-column
  layouts (our core vocab source). `pymupdf` is as good as pdfjs but ships a
  native wheel that's painful to bundle into `.ankiaddon`.
- **One implementation for all backends.** The client is shared by python-server,
  addon, and android — so pdfjs in `client/src/lib/pdf.ts` covers all three
  platforms with no per-backend PDF lib.
- **Lightweight on phones for our use case.** We need `getOutline()` +
  `getTextContent()` per page, not rendering. Parse-only is a few seconds on
  a modern phone for 621 pages and can run in a worker.
- **Server stays stateless.** No big binary uploads, no per-backend PDF lib.
- Cost: ~300 KB added to the bundle. Acceptable; only loaded on the PDF page.

### Division of labor: pdfjs vs LLM

We deliberately split structural (mechanical) work from semantic (contextual) work.
Hardcoded pairing rules ("glossary is always below passage") will break on the
next textbook. The LLM handles what varies; pdfjs provides the structural
signals that make the LLM's job easy.

**pdfjs (structural — in `client/src/lib/pdf.ts`):**

- Extract heading, page range, first/last N lines, full text per section
- Font profile: size, weight, family, indent, column count
- Positional context: neighbouring sections above and below
- Embedded bookmarks when the publisher included them

Font profile is a surprisingly strong semantic hint — "8pt indented two-column"
is what glossaries and footnotes look like across nearly all textbooks. We pass
it to the scout as-is; the LLM reasons about it without us hardcoding what it
means.

**LLM (semantic — in the scout prompt):**

- Classify each section (`vocab` / `passage` / `glossary` / `exercise` / `prose`)
- Link related sections via `relatedTo` (explained below)
- Suggest tags from heading text and surrounding context
- Mark confidence and `worthExtracting`

### `relatedTo` — how sections are paired

Textbooks chain content across sections in ways we can't predict:

- A reading passage followed by a _Vocabulario_ glossary for its hard words
- An exercise (`Ex 6.3`) that drills a vocab list introduced earlier in the chapter
- A dialogue followed by comprehension questions
- A conjugation table that references verbs from a preceding vocab list

Rather than hardcoding each pattern, the scout outputs a `relatedTo: sectionId[]`
for every section. The LLM decides the pairings; our code just respects them.

**Example scout output:**

```json
{
  "sections": [
    { "id": "s12", "type": "passage", "title": "El tren", "relatedTo": ["s13"] },
    { "id": "s13", "type": "glossary", "title": "Vocabulario", "relatedTo": ["s12"] },
    { "id": "s14", "type": "vocab", "title": "Los colores", "relatedTo": [] },
    { "id": "s15", "type": "exercise", "title": "Ex 6.3", "relatedTo": ["s14"] }
  ]
}
```

**How extract uses it.** When extracting section `s12` (_El tren_ passage),
the server sees `relatedTo: ["s13"]`, fetches text for `s13` (the glossary),
and passes both into the passage prompt with roles marked:

- `primary`: the passage text (source of example sentences)
- `supporting`: the glossary text (authoritative word list and definitions)

The passage prompt then produces cards keyed off glossary entries, with example
sentences pulled from the passage. If `relatedTo` is empty, the prompt falls
back to the LLM picking useful vocabulary from the passage alone.

Same pattern for exercises linked to a vocab list: the vocab list becomes
supporting context so the cloze prompt knows the intended answer set.

**User override.** The scout review UI exposes `relatedTo` — user can add a
missing link or remove a wrong one before extract runs. Much easier than
debugging pairing code, and user corrections could become tuning data later.

**Symmetry note.** `relatedTo` is directional in semantics (passage _uses_
glossary as support), but we let the LLM emit it on both sides when the
relationship is mutual. At extract time we only follow links from the section
being extracted — we don't traverse both directions to avoid duplicate cards.

## New files

### Shared

- `shared/prompts/pdf-scout.json` — classify sections from outline + snippets.
- `shared/prompts/pdf-vocab-extract.json` — word/gloss grids → cards.
- `shared/prompts/pdf-passage-extract.json` — reading passages → sentence cards.
- `shared/prompts/pdf-cloze-extract.json` — **slot for cloze agent**, don't
  write it here. Route handles it the moment the file lands.
- `shared/types.ts` additions:
  - `PdfSection` — `{id, heading, pageStart, pageEnd, bodySnippet, fontProfile}`.
    `fontProfile` carries size/weight/indent/columns so the scout sees layout
    cues (glossaries and footnotes are usually small+indented).
  - `ScoutedSection` extends `PdfSection` — adds `contentType`
    (`vocab | passage | glossary | exercise | prose`), `suggestedTags`,
    `worthExtracting`, `confidence`, `relatedTo: string[]`.
  - `PdfScoutRequest` / `PdfScoutResponse`, `PdfExtractRequest` (extract takes
    `primarySection` plus `supportingSections` resolved from `relatedTo`).

### Client

- `client/src/lib/pdf.ts` — pdfjs wrapper:
  - `loadPdf(file): PdfDocument`
  - `extractOutline(doc): PdfSection[]` — bookmarks + heading heuristics,
    column-aware text, preprocessing (header/footer filter, soft-hyphen
    normalize, list-marker strip).
  - `extractSectionText(doc, section): string` — full text for a section.
- `client/src/components/pdf/PdfPage.tsx` — top-level flow.
- `client/src/components/pdf/UploadStep.tsx` — file picker + local outline build.
- `client/src/components/pdf/ScoutStep.tsx` — scouted TOC, checkboxes, tag editor.
- `client/src/components/pdf/ExtractStep.tsx` — streams `CardPreview`s per section.

### Server

- `python-server/anki_defs/services/routes/pdf.py`:
  - `POST /api/pdf/scout` — body `{sections: PdfSection[], language}`, returns
    classified list. One AI call, Flash-tier model.
  - `POST /api/pdf/extract` — body `{sectionText, contentType, tags, deck}`,
    SSE stream of `CardPreview`s. Reuses `_helpers` (sse, cost, parse with
    healing) and `card_extraction.build_card_previews`. Tags passed to
    preview objects.
- `ai.py` additions: `build_pdf_scout_prompt`, `build_pdf_vocab_prompt`,
  `build_pdf_passage_prompt`. Prompt name lookup already generic.

### No changes needed

- `CreateNoteRequest.tags` is already wired (shared/types.ts:266) — tags flow
  through to addNote once preview carries them.
- `streamSSE` in `client/src/lib/api.ts` handles SSE — wrap, don't rewrite.
- `CardPreview` component works unmodified; we pass `tags` via the `preview`
  prop.

## Tagging

Each card gets tags from three sources, merged:

1. **Scout-derived**: chapter slug (`ch6`), topic slug (`los-colores`),
   content type (`vocab` | `passage` | `cloze`).
2. **Source**: `pdf:<slug>` derived from the PDF filename, editable by user
   at scout time.
3. **Auto**: `auto-generated` (already applied by backend — required for
   deletion safety per CLAUDE.md).

User can override per-section tags at scout time and per-card tags in the
existing CardPreview UI.

## Preprocessing (client, before scout)

Applied once per page text:

- Strip running header and footer — detect by recurrence across all pages at
  top/bottom y-position; drop matching lines.
- Normalize `U+00AD` (soft hyphen) — remove when at line-break position,
  rejoining `modi­fies` → `modifies`.
- Collapse numbered list markers `1.\\t` → `1. `.
- Keep column structure: group text items by y-coordinate band, emit in
  left-to-right order within each band.

These are cheap and reliable — much better than asking the AI to ignore them.

## Cloze agent handoff

The cloze agent is writing `pdf-cloze-extract.json` independently. Our route
just looks up the prompt by name:

- Scout prompt already classifies exercises as `contentType: "cloze"`.
- `pdf.py::extract` picks `pdf-cloze-extract.json` when contentType is cloze.
- If the file doesn't exist yet, return 400 with a clear message; the UI
  disables extract for cloze sections until the file lands.

Their prompt needs to output cloze cards matching `CardType: 'cloze'` —
compatible with the existing cloze path in `CreateNoteRequest`. Coordination:
confirm the output schema with them before they merge. (Not in this PR's
scope — it's their PR.)

## Scope for this PR

1. `shared/prompts/pdf-scout.json`, `pdf-vocab-extract.json`,
   `pdf-passage-extract.json` + types.
2. `client/src/lib/pdf.ts` (pdfjs + preprocessing + outline).
3. `client/src/components/pdf/*` — upload → scout → extract flow.
4. `python-server/anki_defs/services/routes/pdf.py` + AI builder functions.
5. Verify tags reach Anki (should be already; test end-to-end).
6. Docs: update `PLANNING/INDEX.md`, `PLANNING/next-steps.md`,
   `DOCS/api-contract.md`, `client/DOCS/file-map.md`, `shared/DOCS/types-reference.md`.

## Out of scope

- Cloze prompt itself (other agent).
- Android/addon PDF UI — add-on server side will work since routes are
  shared; UI can come later per-platform.
- PDF annotation / highlighting UI.
- Resumable per-chapter sessions (scout runs fresh each upload; cheap enough).

## Open questions

- Scout output size cap — what if the PDF has 500+ detectable sections? Plan:
  chunk scout into N-section batches if needed; for 621 pp this shouldn't
  matter (~30–50 sections).
- Should conjugation tables be a separate content type, or fold into `vocab`
  with a hint in the section metadata? Leaning: separate `table` type with
  its own prompt, but defer until we see scout output quality.

---

## Handoff notes (for the next agent)

**Branch**: `feat/pdf-to-cards`. Three commits on top of `main` (`b58c322`):

- `4e5ba2d` feat(pdf): scout + extract backend for textbook PDFs
- `6190668` feat(pdf): minimal UI for scout + extract flow
- `07e96ba` simplify(pdf): address review findings

All checks green when committed: pyright clean, ruff clean, 111 pytests,
client tsc clean, lint 0 errors. The two pre-existing lint warnings in
`MessageInput.tsx` and `photo/ExtractStep.tsx` are unrelated.

### What works end-to-end (on paper)

Upload PDF → pdfjs parses outline locally → `POST /api/pdf/scout` → Gemini
Flash classifies each section + emits `relatedTo` pairings → user reviews
scouted TOC with checkboxes → `POST /api/pdf/extract` streams per section →
`CardPreview` flow shows cards with tags attached → user adds to Anki.

**Not yet tested with a real PDF.** Reference PDF is at
`~/dev/Complete-Spanish-Step-By-Step-Book.pdf` (621 pp). Run
`npm run dev`, click the FileText header icon, upload it. Gemini API key
required (default provider).

### Where behavior will likely need adjustment after first real run

1. **Scout prompt classification quality** (`shared/prompts/pdf-scout.json`).
   We haven't seen actual scout output yet. Expect to iterate on:
   - What counts as `vocab` vs `glossary` (the distinction is "standalone
     list" vs "list attached to a passage" — LLM may not get this right).
   - When `relatedTo` links get emitted too aggressively / not enough.
   - Whether `worthExtracting` marks the answer key correctly.
2. **Heading heuristics in `client/src/lib/pdf.ts`** (`isHeading`, bookmark
   fallback). Current rule: font size ≥ 1.15× page body median, length ≤ 120
   chars. If the Spanish book has lots of embedded bookmarks we use those;
   if not, this heuristic runs. May over- or under-segment. Check
   `ExtractedOutline.sections.length` on first run — if < 20 or > 200 for
   this book, tune.
3. **`fontProfile.columns` is always 1** (see `fontProfileFor` in pdf.ts).
   I skipped column detection for the first cut; the scout still gets size
   and it's enough signal. If vocab grid classification is weak, implement
   column detection by clustering x-coordinates.
4. **Scout token budget**. Plan estimates 10K input tokens for ~30–50
   sections × ~200 tokens each. If scout is sending tens of thousands of
   tokens the first time (more sections than expected), we'll need to
   chunk the scout call — see the first open question above.

### Intentionally deferred (skipped despite being flagged in review)

These were reviewed and deliberately not changed — read the rationale
before "fixing" them:

- **Section extraction runs sequentially, not parallel.** Each section =
  one or two AI calls taking seconds. Parallelizing trades rate-limit
  risk and loss-of-progress visibility for speed. Decide after real use.
- **`previews` state lives in `PdfPage`, not `PdfExtractStep`.** Moving
  it to the child complicates restart/done handling for marginal win.
- **`_run_vocab` and `_run_passage` not unified into a generic pipeline.**
  Vocab has a second AI call and `inject_textbook_definitions`; forcing
  uniformity would hurt clarity.
- **Scout review UI doesn't expose `relatedTo` editing (add/remove).**
  Plan doc promised this as a user override; current UI only shows links,
  doesn't edit them. Worth adding if scout gets pairings wrong often.
- **No `pdf-cloze-extract.json` prompt.** That's the other agent's
  territory. Server returns 400 for `contentType: "exercise"` until the
  file lands. UI doesn't grey-out exercise rows — they just fail at
  extract time. Worth adding a UI warning once we know the cloze agent's
  timeline.

### Known rough edges worth early attention

- **`ExtractedOutline.pages` is held in `PdfPage` state** — all parsed text
  for a 621pp book, possibly several MB. Cleared on "New PDF" click but
  not freed mid-flow. Low priority; mention here so nobody panics.
- **`PdfUploadStep` shows text status only during parse**, no progress bar.
  For a 621pp PDF on mobile this will feel slow. A simple page counter
  (`Parsing page X/N`) during `collectPages` would help — means making
  `extractOutline` emit progress events instead of being a one-shot.
- **Dev examples**: photo flow has `/api/photo/examples` for dev-mode
  testing against saved uploads. PDF flow doesn't have an equivalent.
  If you want to iterate on scout/extract without re-uploading each time,
  add a `/api/pdf/examples` endpoint mirroring photo's pattern.
- **Addon/Android**: routes are wired to python-server only right now.
  `pdf.register(app, anki_connect)` happens in python-server's `main.py`;
  the addon's server doesn't register it. Add to `anki-addon/server/` if
  we want the addon to serve PDFs, but the UI and pdfjs layer are shared
  so the client side already works against both.

### Useful references

- Reference PDF exploration report: see the conversation leading to commit
  `4e5ba2d` (agent sampled `pdftotext` output from the Spanish book and
  documented structure — vocab grids, conjugation tables, reading passages
  _El tren_ p. 79, exercises `K Exercise X.Y`, answer key pp. 579+).
- Photo flow is the closest pattern for anything new. `photo/PhotoCapture.tsx`
  → three-step state machine; `services/routes/photo.py` → two-pass extract
  → generate pipeline (vocab path reuses `build_photo_generate_prompt`).
- Shared helpers to reuse: `_helpers.py` (`sse_event`, `sse_stream`,
  `compute_cost`, `parse_cards_with_healing`, `check_words_parallel`,
  `format_http_error`), `card_extraction.py` (`build_card_previews`,
  `inject_textbook_definitions`). Don't reinvent these.
