# MCP Agent for Flashcard Generation

## Problem

The PDF-to-cards UI has too many decision points for a typical user:
upload → pick chapters → scout → review classifications → pick sections →
extract → review cards. Each step requires domain knowledge the user
shouldn't need ("is this prose or vocab?", "should I check this?").

## Proposal

Expose the pipeline as MCP tools so an AI agent can drive card generation
autonomously, using the existing UI as the review/approval layer.

### Key Insight: No Scout Step

The scout (classify sections via a cheap Flash call) exists to help a
human quickly scan 40+ sections. An agent doesn't need it — it can read
all snippets directly in its context and make better classification
decisions than a one-shot LLM call. The agent IS the classifier.

Agent flow:

1. Parse PDF outline (structural, no AI — pdfjs or server-side parser)
2. Read snippets directly, decide what to extract (agent judgment)
3. Spawn subagents per section to extract in parallel
4. Collect results, spot-check card quality
5. Present batch to user via existing CardPreview UI

### Architecture

```
User: "make flashcards from chapters 3-7"
           │
           ▼
┌─────────────────────────┐
│  AI Agent (Claude)       │
│                         │
│  1. Parse PDF outline   │  ← MCP tool: structural, no AI cost
│  2. Read snippets       │  ← agent reads directly, no scout call
│  3. Decide what to      │
│     extract             │  ← agent judgment > one-shot classifier
│  4. Spawn subagents     │  ← parallel extraction per section
│  5. Spot-check cards    │  ← agent reviews quality
│  6. Present to user     │  ← existing CardPreview UI
└─────────────────────────┘
           │
     MCP tool calls
           │
           ▼
┌─────────────────────────┐
│  anki-defs server       │
│  (existing API)         │
│                         │
│  /api/pdf/extract       │  ← takes section text, returns cards
│  /api/anki/notes        │  ← adds cards to Anki
│  /api/settings          │  ← deck/language config
└─────────────────────────┘
```

### MCP Tools to Expose

1. **`pdf_parse`** — Parse a PDF, return chapters + sections with
   snippets. Wraps pdfjs (needs server-side equivalent — Node script
   or pymupdf). No AI call, pure structural extraction.

2. **`pdf_section_text`** — Get full text for a section by ID. The agent
   reads snippets first (cheap), then requests full text only for
   sections it decides to extract.

3. **`pdf_extract`** — Extract cards from section text. Input: text +
   contentType + tags + deck. Output: card previews (vocab pairs or
   passage cards). Already exists as `POST /api/pdf/extract`.

4. **`anki_add_card`** — Add a card to Anki. Already exists as
   `POST /api/anki/notes`.

5. **`anki_search`** — Check if a word already exists in a deck.
   Lets the agent skip duplicates before presenting to the user.

### What the Agent Does vs What the User Does

**Agent handles:**

- Chapter/section selection (reads snippets, understands structure)
- Content type judgment (vocab vs prose vs passage — no scout needed)
- Extraction orchestration (parallel subagents per section)
- Quality review (are definitions correct? sentences natural?)
- Duplicate detection
- Error recovery (retry failed sections, handle truncation)

**User handles:**

- "Make flashcards from chapters 3-7" (one instruction)
- Review the final card batch (existing CardPreview UI)
- Edit/discard individual cards
- Approve adding to Anki

### Why Subagents Over Sequential

Each section extraction is independent — different text, different prompt.
A coordinator agent can spawn N subagents in parallel, each handling one
section. This is faster than the current sequential loop and naturally
handles failures (one section failing doesn't block others).

### Implementation Notes

- PDF parsing currently runs client-side (pdfjs). For MCP, options:
  - Node script wrapping pdfjs (same code, different runtime)
  - Server-side pymupdf (better for server, but different parser)
  - Agent tells user to upload via UI, reads the parsed outline
- The photo-to-cloze flow benefits from the same pattern
- The existing manual UI still works for power users

### Open Questions

- MCP server: separate process or embedded in Python server?
- Card presentation: push into UI via WebSocket, or return in agent chat?
- Should the agent have direct Anki access or always go through our API?
- Can we reuse the existing `pdf.ts` parsing in a Node MCP server?

## Agent Prompt

```
You're building an MCP server that exposes anki-defs as tools for AI
agents to generate flashcards autonomously.

Start here: read PLANNING/mcp-agent-cards.md for the design, then
DOCS/api-contract.md for the existing REST API you're wrapping.

The server is a Node.js MCP server (TypeScript) that:
1. Wraps the existing REST API at localhost:3001 (pdf/extract,
   anki/notes, settings, etc.)
2. Adds pdf_parse — runs pdfjs in Node to parse a PDF file path into
   chapters + sections with snippets. Reuse the logic from
   client/src/lib/pdf.ts (extractOutline, getSectionText) adapted for
   Node (no Vite worker URL, use the legacy build).
3. Adds pdf_section_text — returns full text for a section by ID from
   a previously parsed PDF.

Key design decisions:
- No scout tool. The agent reads snippets and decides what to extract.
- The PDF parse result needs to be held in memory between calls (parse
  once, extract many). Use a session/cache keyed by file path.
- Keep it minimal — 5 tools max. The agent is smart; tools are simple.

Refer to client/src/lib/pdf.ts for parsing logic (extractOutline,
loadPdf, getSectionText, y-coordinate filtering). Port to Node — main
difference is worker setup and file loading (File API → fs.readFileSync).

Put the MCP server in a new top-level directory mcp-server/. Use the
Anthropic MCP SDK.
```

## Status

Idea stage. REST API and UI components exist. MCP wrapper and agent
orchestration are the new work.
