# Progress

## Web App (client/ + ankiconnect-server/ + shared/)

### Done

- Express server + React/Vite client monorepo with shared types
- SSE streaming for AI responses with three providers (Claude, Gemini, OpenRouter)
- AnkiConnect integration via `yanki-connect` (remote-capable over Tailscale)
- System prompts for: single word, sentence, focused words, card extraction, define, analyze
- Bangla-specific prompt rules (lemmatization, example quality, translation formatting)
- Card extraction pipeline: AI streams analysis -> Gemini extracts structured cards -> Anki duplicate check -> lemma mismatch detection
- Card preview UI with inline editing, add/skip/queue, undo, duplicate badges
- Zustand stores with persistence for chat, token usage, session cards, settings
- AI provider selection with model dropdowns, API key management
- Server-side session sync with SQLite
- Mobile-friendly responsive UI with `fixed inset-0` layout (no keyboard flash)
- `interactive-widget=resizes-content` viewport meta for smooth keyboard behavior
- Contained scroll (scrollContainerRef + scrollTop) to prevent header displacement
- Mobile deck selector (icon + full-screen overlay) separate from desktop dropdown
- Anki sync button in header (RefreshCw icon, platform-aware -- hidden on Android)
- Left-handed mode (action buttons on left side of card previews)
- Bearer token auth on all `/api/*` routes (localhost exempt, auto-generated token)
- CORS restricted to localhost origins
- Note deletion ownership check (requires `auto-generated` tag)
- Backslash escaping in Anki search queries
- Shared prompt templates in `shared/prompts/*.json` (7 templates + variables.json)
- Configurable card field mapping in Settings UI

### Not Done

- Automated tests (no vitest/jest installed)
- CI pipeline
- Disambiguation support
- Root word suggestions
- Unmarked sentence mode
- File permissions on settings.json (chmod 0600)

## Android App (android/)

### Done

- WebView loading shared React frontend from local NanoHTTPd server
- NanoHTTPd API handlers implementing same contract as ankiconnect-server
- Gemini API integration with streaming
- AnkiDroid ContentProvider integration (decks, notes, duplicate detection)
- Custom "word2anki" 4-field note model with Basic fallback
- Share intent support (ACTION_SEND, ACTION_PROCESS_TEXT)
- JS bridge (AndroidBridge) for permission requests, Anki detection
- Platform detection (`/api/platform` returns `"android"`)
- NanoHTTPd bound to 127.0.0.1 (localhost only)
- Gradle tasks for frontend build + asset copy
- 95 unit tests across 7 test classes

### Not Done

- Shared prompt templates (prompts hardcoded in Kotlin)
- Quick-translate native popup
- Multiple AI providers (Gemini only)

## Anki Add-on (anki-addon/)

### Done

- Entry point with menu item and profile hooks (`__init__.py`)
- Non-blocking socket HTTP server (QTimer-polled, AnkiConnect pattern)
- URL router with path parameter matching
- Static file serving with SPA fallback
- All `/api/anki/*` endpoints (direct collection access via `mw.col`)
- All `/api/chat/*` endpoints (streaming SSE + non-streaming)
- Claude, Gemini, OpenRouter providers (stdlib `urllib.request` only)
- Card extraction pipeline (Gemini structured output)
- Settings via Anki addon config system (`config.json` + `meta.json`)
- Session persistence (SQLite in `user_files/`)
- `/api/platform`, `/api/health`, `/api/settings`, `/api/session/*`
- Zero vendored dependencies (all stdlib)
- Bearer token auth (localhost exempt, same pattern as Express)
- Note deletion ownership check (`auto-generated` tag)
- Backslash escaping in search queries
- MAX_BODY_SIZE enforcement
- Dev workflow: `uv` + `pyproject.toml`, ruff, pyright, pytest
- 45 unit tests (HTTP server, router, SSE, card extraction, shared data)
- Build script (`scripts/build-addon.sh`) -- packages as `.ankiaddon`
- Dev install script (`scripts/install-dev.sh`) -- symlinks into Anki addons dir

### Not Done

- Manual testing inside Anki Desktop
- Prompt template sharing (reads own copies, not shared/prompts/)
- AnkiWeb distribution / publishing

## Documentation (docs/)

### Done

- Astro Starlight site with 6 pages (home, getting-started, usage, tailscale, architecture, anki-addon)
- Configured for GitHub Pages at `ianhuntisaak.github.io/anki-defs`
- GitHub Actions workflow file on disk (`.github/workflows/docs.yml`)
- README.md with feature list, installation, architecture diagram, usage guide

### Not Done

- GitHub Actions workflow not committed (needs `workflow`-scoped token)
- No automated deployment yet

## Security

### Done

- Full security audit with 2 critical, 4 high, 5 medium, 4 low findings
- 7 of 9 recommended fixes implemented (see `PLANNING/security-audit.md`)

### Not Done

- File permissions on settings.json (chmod 0600)
- Note existence check before deletion in add-on

## Monorepo (Phase 1)

### Done

- word2anki merged into android/ via git subtree (full history preserved)
- CLAUDE.md hierarchy: root + client/ + ankiconnect-server/ + shared/ + android/
- DOCS/ directories with file maps and API contract reference
- PLANNING/ directories with INDEX.md at each level
- .gitignore covers Node.js, Android/Gradle, Python, and docs
- Both projects build: `npm run check` passes, `./gradlew assembleDebug` succeeds
- Server renamed from `server/` to `ankiconnect-server/`
