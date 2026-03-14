# anki-defs -- Vocabulary Flashcard Tool

Multi-platform app for creating Anki flashcards from AI-generated vocabulary definitions.
One React frontend, multiple backends (web/desktop, Android, future Anki add-on).

## Architecture

The React frontend is THE frontend for all platforms. Each platform provides its own backend
that serves the frontend and implements the same HTTP API.

```
client/              -- React frontend (shared by ALL platforms)
shared/              -- TypeScript types + prompt templates (API contract: shared/types.ts)
python-server/       -- Backend #1: Python FastAPI + AnkiConnect (desktop/web)
android/             -- Backend #2: Kotlin + NanoHTTPd + AnkiDroid ContentProvider
anki-addon/          -- Backend #3: Python inside Anki Desktop (shares services with python-server)
docs/                -- Astro Starlight documentation site (GitHub Pages)
scripts/             -- Build/install scripts (build-addon.sh, install-dev.sh)
```

## Build Commands

```bash
# Web (Python server + React client)
npm install && npm run dev       # Dev server (python-server + client)
npm run check                    # Typecheck + lint + format (TypeScript)
npm run check:py                 # Ruff + pyright + pytest (Python)

# Python server standalone
cd python-server
uv sync --group dev
uv run ruff check . && uv run pyright && uv run pytest tests/ -v

# Android
cd android && export ANDROID_HOME=~/Android/Sdk && export JAVA_HOME=/usr
./gradlew assembleDebug

# Anki add-on
cd anki-addon
uv sync --group dev              # Dev tools (ruff, pyright, pytest)
uv run ruff check . && uv run pytest tests/ -v
scripts/build-addon.sh           # Package as .ankiaddon
scripts/install-dev.sh           # Symlink into Anki addons dir

# Docs site
cd docs && npm install && npm run dev  # Local dev server
```

## Code Quality

- **TypeScript**: All web code must pass strict mode, ESLint, and Prettier (`npm run check`).
- **Python**: All server code must pass ruff, pyright, and pytest (`npm run check:py`).

## Team Coordination

When working as a team with multiple agents, see `PLANNING/team-workflow.md` for the
coordinator's playbook (worktree discipline, merge strategy, agent prompt template).

**For agents (team members)**: You own the directories stated in your task prompt. Update
the relevant PLANNING/ and DOCS/ files in the same commit as code changes. Do not modify
files outside your stated scope.

## Network & Security

- Python server (FastAPI/uvicorn) binds to `0.0.0.0` for Tailscale access. Bearer token
  auth protects all `/api/*` routes -- localhost requests are exempt, remote requests
  require `Authorization: Bearer <token>`. Token auto-generated on first startup.
- Vite dev server also binds to all interfaces (`host: true`) with `allowedHosts` check.
- CORS restricted to localhost origins. Android NanoHTTPd binds to `127.0.0.1`.
- Anki add-on binds to `0.0.0.0` with bearer token auth (same pattern as python-server).
- Note deletion requires the `auto-generated` tag -- prevents deleting hand-crafted cards.
- See `PLANNING/security-audit.md` for the full audit and findings.

## Secrets & Pre-Commit Hooks

**CRITICAL**: Never commit API keys, tokens, or user data files. Pre-commit hooks
(prek) are installed to catch this automatically -- do NOT bypass them with `--no-verify`.

- `prek.toml` configures hooks: `detect-private-key`, `check-api-keys`, `block-sensitive-files`
- Blocked files: `meta.json`, `session.db*`, `.env*`, `credentials.json`, `settings.json`
- API keys live in `~/.config/bangla-anki/settings.json` (standalone server) or Anki's
  addon config (addon). They are NEVER checked into the repo.
- When staging files, use `git add <specific files>` -- never `git add -A` or `git add .`
- If a pre-commit hook blocks your commit, **fix the issue** -- do not skip the hook.
- The Anki addon's `meta.json` and `user_files/` are gitignored. If git tries to stage
  them, something is wrong with the `.gitignore`.

## Cross-Cutting Rules

- API contract changes must be coordinated across ALL backends.
- Prompt templates live in `shared/prompts/*.json` -- not duplicated per-backend.
- Platform-specific UI uses a platform detection hook, not separate components.
- This is an application, not a library. No backwards-compatibility shims.
- **No duplication**: Always reuse shared constants, components, and utilities. Model lists,
  pricing data, and types belong in `shared/`. UI components should be reused, not recreated.
  If you need the same data or logic in two places, put it in `shared/` or extract a component.

## Starting Work

**Clean tree first**: Before starting any new task, check `git status`. If there are
uncommitted changes, commit them first (use a subagent to save context). Never start
work on a dirty tree — uncommitted changes cause confusion and merge conflicts.

**Read first**: Before starting work, read `PLANNING/INDEX.md` for current status and
priorities. Read the relevant plan doc for your task.

## Documentation Workflow

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
