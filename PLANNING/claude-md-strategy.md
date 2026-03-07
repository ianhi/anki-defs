# CLAUDE.md Strategy: Multi-Agent Monorepo

## Problem
With a monorepo containing `web/` and `android/`, multiple Claude Code agents may work simultaneously:
- An agent in `android/` shouldn't need to understand React/Vite
- An agent in `web/` shouldn't need to understand Gradle/Kotlin
- An agent at root needs the big picture
- All agents need to understand the shared API contract

## CLAUDE.md Hierarchy

Claude Code loads CLAUDE.md files from the working directory AND all parent directories up to the repo root. So an agent working in `android/app/` sees:
1. `CLAUDE.md` (repo root — project overview, API contract, architecture)
2. `android/CLAUDE.md` (Android-specific: Kotlin, Gradle, emulator)
3. `android/app/CLAUDE.md` (if needed — build config specifics)

An agent in `web/client/` sees:
1. `CLAUDE.md` (repo root)
2. `web/CLAUDE.md` (web-specific: Node.js, React, Vite)
3. `web/client/CLAUDE.md` (if needed)

## File Plan

### 1. Root `CLAUDE.md` — Shared context for ALL agents

Contents:
- Project name and one-line description
- Architecture diagram (3 backends, 1 frontend)
- **API contract summary** — the critical shared interface
  - List of endpoints with request/response shapes
  - SSE event types
  - Link to `web/shared/types.ts` as source of truth
- Repo structure (top-level directory map)
- Development process rules (document as you go, etc.)
- Cross-project conventions:
  - Prompt templates are shared data (not duplicated)
  - Platform detection via `/api/platform`
  - Changes to API contract must update both backends
- Links to PLANNING/, PROGRESS.md, FUTURE_FEATURES.md

What NOT to put here:
- Language-specific build commands
- Framework-specific patterns
- Detailed file listings within subprojects

### 2. `android/CLAUDE.md` — Android agent context

Contents:
- Tech stack (Kotlin, Jetpack Compose for popup only, NanoHTTPd)
- Build commands (`./gradlew assembleDebug`, test, etc.)
- Environment setup (ANDROID_HOME, JAVA_HOME, SDK)
- Project structure (`app/src/main/kotlin/com/word2anki/`)
- Architecture patterns:
  - Local HTTP server serves API + frontend assets
  - AnkiRepository wraps ContentProvider
  - GeminiService for AI calls
  - WebView loads React frontend from localhost
- Key files and what they do
- Testing (unit tests, emulator, ADB commands)
- Known quirks (Compose in uiautomator, etc.)

### 3. `web/CLAUDE.md` — Web agent context

Contents:
- Tech stack (TypeScript, React 19, Vite, Tailwind, Express 5)
- Build commands (`npm run dev`, `npm run build`, `npm test`)
- Workspace layout (client/, server/, shared/)
- Architecture patterns:
  - SSE streaming for AI responses
  - Zustand for state management
  - AnkiConnect for desktop Anki integration
- Key files and what they do
- Platform awareness:
  - Frontend must work on web AND Android WebView
  - Check `usePlatform()` hook for conditional rendering
  - Never hardcode backend assumptions
- Prompt templates location and format
- API contract: "You own the contract — android/ implements it too"

### 4. `web/shared/CLAUDE.md` (optional, small)

Contents:
- This directory defines the API types shared between all backends
- Changes here affect: web server, web client, Android backend
- Always run both web and Android tests after changes

## Key Principles

### 1. No duplication between CLAUDE.md files
Root has the overview. Subfolders have specifics. Don't repeat.

### 2. API contract is the boundary
Any agent working on either side needs to know the API contract. Root CLAUDE.md has the summary; `web/shared/types.ts` is the source of truth.

### 3. Cross-cutting changes get flagged
If an agent in `web/` changes the API contract, it must note: "Android backend needs updating." Root CLAUDE.md should state this rule.

### 4. Keep them concise
Each CLAUDE.md should be readable in <2 minutes. Link to PLANNING/ docs for details.

## Template: Root CLAUDE.md

```markdown
# anki — Vocabulary Flashcard Tool

Multi-platform app for creating Anki flashcards from AI-generated vocabulary definitions.
One React frontend, multiple backends (web, Android, Anki add-on).

## Architecture
[diagram]

## API Contract
The frontend communicates with backends via `/api/*` endpoints.
Source of truth: `web/shared/types.ts`
[endpoint summary table]

## Repo Structure
- `web/` — React frontend + Node.js backend (see web/CLAUDE.md)
- `android/` — Android app with local HTTP backend (see android/CLAUDE.md)
- `PLANNING/` — Architecture docs and implementation plans

## Development Rules
- Document as you go — update docs in the same commit as code
- API contract changes must be coordinated across backends
- Prompt templates are shared data files, not duplicated per-backend
- Platform-specific UI uses `usePlatform()` hook, not separate components

## Build
- Web: `cd web && npm run dev`
- Android: `cd android && ./gradlew assembleDebug`
- Frontend for Android: `cd web && npm run build:client`
```
