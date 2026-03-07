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
- This is an application, not a library. No backwards-compatibility shims.

## Documentation Workflow

**Read first**: Before starting work, read `PLANNING/INDEX.md` for current status and
priorities. Read the relevant plan doc for your task.

**Update as you go** -- in the same commit as code changes:

- `PLANNING/` -- Plans, requirements, design proposals.
  - When you **finish implementing** a plan: update its status in the plan doc and in
    `PLANNING/INDEX.md`. If the plan is fully implemented, delete the file and remove
    it from INDEX.md (don't accumulate stale plans).
  - When you **discover new requirements**: create a new `.md` and add it to INDEX.md.
  - When a plan becomes **partially done**: update the doc to show what's done vs remaining.
- `DOCS/` -- Implementation reference (API details, file maps, patterns).
  - When you **add/remove/rename files**: update the relevant `DOCS/file-map.md`.
  - When you **change the API**: update `DOCS/api-contract.md` and `shared/DOCS/types-reference.md`.

Each subproject has its own `PLANNING/` and `DOCS/` directories. Root-level ones cover
cross-cutting concerns.
