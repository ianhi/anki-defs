# MCP Agent for Flashcard Generation

## Problem

The PDF-to-cards UI has too many decision points for a typical user:
upload → pick chapters → scout → review classifications → pick sections →
extract → review cards. Each step requires domain knowledge the user
shouldn't need ("is this prose or vocab?", "should I check this?").

The scout classification works well technically but the multi-step review
flow is burdensome. An AI agent can make these judgment calls better than
heuristics — it can read the snippets, understand textbook structure, and
decide what's worth extracting.

## Proposal

Expose the existing pipeline as MCP tools so an AI agent (Claude, etc.)
can drive the card generation process autonomously, using the existing UI
as the presentation layer.

### Architecture

```
User: "make flashcards from chapters 3-7"
           │
           ▼
┌─────────────────────────┐
│  AI Agent (Claude Code)  │
│                         │
│  Drives the pipeline:   │
│  1. Parse PDF           │
│  2. Scout sections      │
│  3. Judge quality       │  ← agent reads snippets, decides what to extract
│  4. Extract cards       │
│  5. Spot-check results  │  ← agent reviews card quality
│  6. Present to user     │  ← via existing CardPreview UI
└─────────────────────────┘
           │
     MCP tool calls
           │
           ▼
┌─────────────────────────┐
│  anki-defs server       │
│  (existing API)         │
│                         │
│  /api/pdf/scout         │
│  /api/pdf/extract       │
│  /api/anki/notes        │
│  /api/settings          │
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│  Existing UI            │
│  CardPreview, scout     │
│  review, extract step   │  ← becomes "show your work" + approval layer
└─────────────────────────┘
```

### MCP Tools to Expose

The server already has REST endpoints. The MCP server wraps them:

1. **`pdf_parse`** — Upload a PDF, get back chapters + section list.
   Wraps the client-side pdfjs parsing (would need a server-side
   equivalent or a headless browser step).

2. **`pdf_scout`** — Classify sections. Input: sections array + deck.
   Output: classified sections with contentType, tags, confidence.
   Already exists as `POST /api/pdf/scout`.

3. **`pdf_extract`** — Extract cards from a section. Input: primary
   section text + supporting sections + tags. Output: card previews.
   Already exists as `POST /api/pdf/extract` (SSE).

4. **`anki_add_card`** — Add a card to Anki. Input: card data + deck.
   Already exists as `POST /api/anki/notes`.

5. **`anki_search`** — Check if a word already exists. Useful for the
   agent to skip duplicates before presenting to the user.

### What the Agent Does (that the UI currently asks the user to do)

- **Chapter selection**: Agent reads the chapter list and picks the ones
  the user asked for (or all of them).
- **Section filtering**: Agent reads scout results + snippets and decides
  which sections have extractable content. No need for the user to
  understand contentType classifications.
- **Quality check**: Agent reviews generated cards — are the definitions
  correct? Are example sentences natural? Flags issues instead of showing
  everything.
- **Batch management**: Agent handles the sequential extraction, batching,
  and error recovery. User sees finished cards, not intermediate state.

### What the User Still Does

- Picks the PDF and says what they want ("chapters 3-7", "all vocab",
  "just the reading passages")
- Reviews the final card batch in the existing CardPreview UI
- Edits/discards individual cards
- Approves adding to Anki

### Why This Is Better

- User makes 1-2 decisions instead of 6-8
- Agent's judgment on "is this extractable?" is better than showing
  the user a list of contentType badges
- The manual UI flow still works for power users who want control
- The agent can handle edge cases (scout truncation, misclassification)
  that the UI can't easily surface

### Implementation Notes

- The PDF parsing currently runs client-side (pdfjs in browser). For
  MCP, we'd need either:
  - A server-side PDF parser (pypdf or pymupdf)
  - The agent telling the user to upload via the UI first
  - A headless pdfjs step (Node script)
- The existing REST API is already the right shape for MCP tools
- The photo-to-cloze flow would benefit from the same pattern

### Open Questions

- Should the MCP server be a separate process or embedded in the
  existing Python server?
- How does the agent present cards to the user? Options:
  - Push cards into the existing UI via WebSocket/SSE
  - Return card data to the agent's chat context for inline display
  - Write cards to a review queue the UI polls
- Should the agent have direct Anki access or always go through our API?

## Status

Idea stage. The REST API and UI components exist; the MCP wrapper and
agent orchestration logic are the new work.
