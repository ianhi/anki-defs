# Server -- Express Backend

Node.js backend for desktop/web platform. Proxies AI APIs, manages AnkiConnect, serves settings.

## Tech Stack

- Express.js 5, TypeScript strict mode
- `yanki-connect` 3.x (typed AnkiConnect client)
- Claude, Gemini, and OpenRouter AI providers (all with streaming)
- SSE for streaming AI responses
- SQLite (better-sqlite3) for session persistence

## Patterns

- **SSE streaming**: `Content-Type: text/event-stream`, discriminated event union (`content`, `card`, `done`, `error`)
- **AI provider abstraction**: Unified interface delegates to Claude/Gemini/OpenRouter based on user settings
- **Card extraction pipeline**: AI response -> parse structured card data -> Anki duplicate check -> card events
- **AnkiConnect**: `yanki-connect` method chaining for Anki Desktop integration

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
See `DOCS/` for file map, API details, and implementation reference.
See `PLANNING/` for upcoming work and design proposals.
