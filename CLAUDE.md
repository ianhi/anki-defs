# anki-defs -- Vocabulary Flashcard Tool

Multi-platform app for creating Anki flashcards from AI-generated vocabulary definitions.
One React frontend, multiple backends (web/desktop, Android, future Anki add-on).

## Architecture

The React frontend is THE frontend for all platforms. Each platform provides its own backend
that serves the frontend and implements the same HTTP API.

```
client/    -- React frontend (shared by ALL platforms)
shared/    -- TypeScript types (API contract source of truth)
server/    -- Backend #1: Node.js + Express + AnkiConnect (desktop/web)
android/   -- Backend #2: Kotlin + NanoHTTPd + AnkiDroid ContentProvider
```

## API Contract

All backends implement `/api/*` endpoints. Source of truth: `shared/types.ts`

| Route Group     | Endpoints                                           |
| --------------- | --------------------------------------------------- |
| `/api/anki`     | `/decks`, `/models`, `/notes`, `/search`, `/status` |
| `/api/chat`     | `/stream` (SSE), `/define`, `/analyze`              |
| `/api/settings` | `GET /`, `PUT /`                                    |
| `/api/session`  | `GET /cards`, `DELETE /cards/:id`                   |

## Build Commands

```bash
# Web
npm install && npm run dev       # Dev server (client + server)
npm run check                    # Typecheck + lint + format

# Android
cd android && export ANDROID_HOME=~/Android/Sdk && export JAVA_HOME=/usr
./gradlew assembleDebug
```

## Code Quality (Web)

All web code must pass TypeScript strict mode, ESLint, and Prettier (`npm run check`).

## Cross-Cutting Rules

- API contract changes must be coordinated across ALL backends.
- Prompt templates are shared data -- not duplicated per-backend.
- Platform-specific UI uses a platform detection hook, not separate components.
- Document as you go -- update docs in the same commit as code changes.
- This is an application, not a library. No backwards-compatibility shims.

## Key Docs

- [PLANNING/](./PLANNING/) -- Architecture and migration plans
- [PROGRESS.md](./PROGRESS.md) -- Android app progress tracker
- [FUTURE_FEATURES.md](./FUTURE_FEATURES.md) -- Planned features
