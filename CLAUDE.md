# anki-defs -- Vocabulary Flashcard Tool

Multi-platform app for creating Anki flashcards from AI-generated vocabulary definitions.
One React frontend, multiple backends (web/desktop, Android, future Anki add-on).

## Architecture

The React frontend is THE frontend for all platforms. Each platform provides its own backend
that serves the frontend and implements the same HTTP API.

```
client/    -- React frontend (shared by ALL platforms)
shared/    -- TypeScript types (API contract source of truth: shared/types.ts)
server/    -- Backend #1: Node.js + Express + AnkiConnect (desktop/web)
android/   -- Backend #2: Kotlin + NanoHTTPd + AnkiDroid ContentProvider
```

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

## Documentation Structure

Each subproject has two doc directories:

- `PLANNING/` -- Future plans, requirements, design proposals. Agents create and update
  planning docs as they define requirements or implement features. Each PLANNING/ dir has
  an INDEX.md table of contents.
- `DOCS/` -- Implementation reference (API details, file maps, patterns). Agents update
  these as the code evolves.

Root-level PLANNING/ and DOCS/ cover cross-cutting concerns.
