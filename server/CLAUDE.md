# Server -- Express Backend

Node.js backend for desktop/web platform. Proxies AI APIs, manages AnkiConnect, serves settings.

## Tech Stack

- Express.js 5, TypeScript strict mode
- `yanki-connect` 3.x (typed AnkiConnect client)
- `@anthropic-ai/sdk` (Claude), `@google/genai` (Gemini), OpenRouter
- SSE (Server-Sent Events) for streaming AI responses
- SQLite (better-sqlite3) for session persistence

## Key Files

- `src/index.ts` -- Express app entry, middleware, static serving
- `src/routes/chat.ts` -- SSE streaming endpoint, card extraction pipeline
- `src/routes/anki.ts` -- AnkiConnect proxy routes (decks, models, notes, search)
- `src/routes/settings.ts` -- Settings CRUD
- `src/routes/session.ts` -- Session card persistence
- `src/services/ai.ts` -- Unified AI interface, prompt templates, provider routing
- `src/services/claude.ts` -- Claude API streaming
- `src/services/gemini.ts` -- Gemini API streaming
- `src/services/openrouter.ts` -- OpenRouter API streaming
- `src/services/anki.ts` -- AnkiConnect wrapper (`yanki-connect` method chaining)
- `src/services/cardExtraction.ts` -- Extract card data from AI responses
- `src/services/settings.ts` -- Settings file management (`~/.config/bangla-anki/settings.json`)
- `src/services/session.ts` -- SQLite session store

## Patterns

- **SSE streaming**: Set `Content-Type: text/event-stream`, write `data: ${JSON.stringify(event)}\n\n`. Events are a discriminated union: `content`, `card`, `done`, `error`.
- **AI provider switching**: `ai.ts` delegates to Claude/Gemini/OpenRouter based on user settings.
- **AnkiConnect**: Uses `yanki-connect` with method chaining: `client.deck.deckNames()`, `client.note.findNotes()`, etc.
- **Card extraction**: AI response → `cardExtraction.ts` parses structured card data → duplicate check against Anki → `card` SSE event.

## Adding a New API Endpoint

1. Add route handler in `src/routes/`
2. Add types in `shared/types.ts`
3. Register route in `src/index.ts`
4. Client-side: add fetch wrapper in `client/src/lib/api.ts`

## Modifying AI Prompts

1. Edit system prompts in `src/services/ai.ts`
2. Update expected JSON response format if needed
3. Update types in `shared/types.ts` if response shape changes

## Boundaries

- **You own**: `server/` (Express backend)
- **You consume**: `shared/types.ts` (API contract -- do not modify without coordinating)
- **You do NOT touch**: `client/`, `android/`
- If you change the API contract, note that the Android backend and client need updating.

## Dev Commands

```bash
npm run dev:server    # Express dev server only
npm run dev           # Client + server together (from repo root)
```

See root CLAUDE.md for code quality rules.
