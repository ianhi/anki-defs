# anki-defs -- Vocabulary Flashcard Tool

Multi-platform app for creating Anki flashcards from AI-generated vocabulary definitions.
One React frontend, multiple backends (web/desktop, Android, future Anki add-on).

## Architecture

The React frontend is THE frontend for all platforms. Each platform provides its own backend
that serves the frontend and implements the same HTTP API.

- `client/` -- React frontend (shared by all platforms)
- `shared/` -- TypeScript types (API contract source of truth: `shared/types.ts`)
- `server/` -- Backend #1: Node.js + Express + AnkiConnect (desktop/web)
- `android/` -- Backend #2: Kotlin + NanoHTTPd + AnkiDroid ContentProvider

## API Contract

All backends implement the same `/api/*` endpoints. Source of truth: `shared/types.ts`

| Route Group     | Endpoints                                           |
| --------------- | --------------------------------------------------- |
| `/api/anki`     | `/decks`, `/models`, `/notes`, `/search`, `/status` |
| `/api/chat`     | `/stream` (SSE), `/define`, `/analyze`              |
| `/api/settings` | `GET /`, `PUT /`                                    |

Changes to the API contract must be coordinated across all backends.

## Development

### Web (client + server)

```bash
npm install          # Install dependencies
npm run dev          # Run both client and server
npm run check        # Run typecheck + lint + format check
```

See [AGENTS.md](./AGENTS.md) for detailed web codebase instructions.

### Android

```bash
cd android
export ANDROID_HOME=~/Android/Sdk
export JAVA_HOME=/usr
./gradlew assembleDebug
```

See [android/CLAUDE.md](./android/CLAUDE.md) for Android-specific instructions.

## Code Quality (Web)

All web code must pass:

- TypeScript strict mode (`npm run typecheck`)
- ESLint (`npm run lint`)
- Prettier formatting (`npm run format:check`)

## Cross-Cutting Rules

- This is an application, not a library. No external consumers. No backwards-compatibility shims.
- Prompt templates are shared data -- not duplicated per-backend.
- Platform-specific UI uses a platform detection hook, not separate components.
- Document as you go -- update docs in the same commit as code changes.

## Key Docs

- [AGENTS.md](./AGENTS.md) -- Detailed web codebase guide
- [android/CLAUDE.md](./android/CLAUDE.md) -- Android development guide
- [PLANNING/](./PLANNING/) -- Architecture and migration plans
- [PROGRESS.md](./PROGRESS.md) -- Android app progress tracker
- [FUTURE_FEATURES.md](./FUTURE_FEATURES.md) -- Planned features
