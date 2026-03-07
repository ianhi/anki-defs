# anki-defs -- Vocabulary Flashcard Tool

Multi-platform app for creating Anki flashcards from AI-generated vocabulary definitions.
One React frontend, multiple backends (web/desktop, Android, future Anki add-on).

## Architecture

The React frontend is THE frontend for all platforms. Each platform provides its own backend
that serves the frontend and implements the same HTTP API.

```
client/              -- React frontend (shared by ALL platforms)
shared/              -- TypeScript types + prompt templates (API contract: shared/types.ts)
ankiconnect-server/  -- Backend #1: Node.js + Express + AnkiConnect (desktop/web)
android/             -- Backend #2: Kotlin + NanoHTTPd + AnkiDroid ContentProvider
anki-addon/          -- Backend #3: Python inside Anki Desktop (direct collection access)
docs/                -- Astro Starlight documentation site (GitHub Pages)
scripts/             -- Build/install scripts (build-addon.sh, install-dev.sh)
```

## Build Commands

```bash
# Web
npm install && npm run dev       # Dev server (client + server)
npm run check                    # Typecheck + lint + format

# Android
cd android && export ANDROID_HOME=~/Android/Sdk && export JAVA_HOME=/usr
./gradlew assembleDebug

# Anki add-on
cd anki-addon
uv sync --group dev              # Dev tools (ruff, pyright, pytest)
uv run ruff check . && uv run pyright && uv run pytest tests/ -v
scripts/build-addon.sh           # Package as .ankiaddon
scripts/install-dev.sh           # Symlink into Anki addons dir

# Docs site
cd docs && npm install && npm run dev  # Local dev server
```

## Code Quality (Web)

All web code must pass TypeScript strict mode, ESLint, and Prettier (`npm run check`).

## Team Coordination Mode

When the user asks you to manage a team or launch agents, you are a **coordinator, not an
implementer**. Keep your context for high-level planning, review, and delegation:

- **Delegate** all implementation work (code, docs, config) to spawned agents.
- **Keep** your focus on: task breakdown, priority decisions, cross-cutting concerns,
  reviewing agent output, merging branches, and communicating status to the user.
- **Don't** write code yourself unless the user explicitly asks you to make a change directly
  or it's a trivial meta-task (e.g., updating CLAUDE.md itself).

When not in team mode, implement directly as usual.

### Git Worktree Discipline

**Hard rule**: Always launch agents with `isolation: "worktree"` so they work on isolated
branches. Never let multiple agents commit directly to main.

**Coordinator workflow**:

1. **Launch** agents with `isolation: "worktree"`. Each gets its own branch and working copy.
2. **Scope** each agent to non-overlapping directories when possible (e.g., one agent owns
   `client/`, another owns `ankiconnect-server/`). State the scope in the agent prompt.
3. **Merge** completed agent branches one at a time on main:
   ```
   git merge <agent-branch> --no-ff
   ```
   If two agents touched overlapping files, merge the first, then rebase the second
   before merging.
4. **Rebase stale agents**: If main has advanced while an agent is working, the agent's
   branch may need rebasing before merge. The coordinator handles this, not the agent.
5. **Cross-cutting changes** (shared/types.ts, CLAUDE.md, root PLANNING/) should be done
   by the coordinator directly on main, not by agents, to avoid conflicts.

**Agent prompt template** -- include these in every agent prompt:
- Which directories/files the agent owns (and must not touch outside of)
- That they must update PLANNING/ and DOCS/ in the same commit as code changes
- That they should commit early and often with descriptive messages
- The current branch and any recent main commits they should be aware of

## Network & Security

- Express binds to `0.0.0.0` (all interfaces) for Tailscale access. Bearer token auth
  protects all `/api/*` routes -- localhost requests are exempt, remote requests require
  `Authorization: Bearer <token>`. Token auto-generated on first startup in settings.json.
- Vite dev server also binds to all interfaces (`host: true`) with `allowedHosts` check.
- CORS restricted to localhost origins on Express. Android NanoHTTPd binds to `127.0.0.1`.
- Anki add-on binds to `0.0.0.0` with bearer token auth (same pattern as Express).
- Note deletion requires the `auto-generated` tag -- prevents deleting hand-crafted cards.
- See `PLANNING/security-audit.md` for the full audit and findings.

## Cross-Cutting Rules

- API contract changes must be coordinated across ALL backends.
- Prompt templates live in `shared/prompts/*.json` -- not duplicated per-backend.
- Platform-specific UI uses a platform detection hook, not separate components.
- This is an application, not a library. No backwards-compatibility shims.

## Documentation Workflow

**Read first**: Before starting work, read `PLANNING/INDEX.md` for current status and
priorities. Read the relevant plan doc for your task.

**Hard rule**: Every commit that changes code MUST also update the relevant PLANNING/ or
DOCS/ file. If no doc update is needed, state why in the commit message.

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
