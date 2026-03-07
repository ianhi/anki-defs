# Planning Index

## Start Here

The project has three backends sharing one React frontend. All backends are functional.

**Top priorities (in order):**
1. Add automated tests to the web stack -- no vitest/jest exists yet, zero test coverage
   on client/ and ankiconnect-server/
2. Set up CI pipeline (GitHub Actions) -- lint + typecheck + test on every push
3. Manually test the anki-addon inside Anki Desktop -- code complete but never run in Anki

## Current Status

### What's Working

- **Web app** (`client/` + `ankiconnect-server/`): Full feature set -- AI streaming, card
  creation, duplicate detection, session tracking, offline queue, sync button, mobile UX.
  Bearer token auth for Tailscale access. Three AI providers (Claude, Gemini, OpenRouter).

- **Android app** (`android/`): WebView loading shared React frontend via NanoHTTPd. Gemini
  API, AnkiDroid ContentProvider, share intents, JS bridge. Phases 1-5 complete.

- **Anki add-on** (`anki-addon/`): Python backend running inside Anki Desktop. Direct
  collection access, QTimer-polled socket server, all API endpoints, SSE streaming, three
  AI providers. Zero vendored dependencies (stdlib only). 45 unit tests. Build/install
  scripts in `scripts/`.

- **Shared prompts** (`shared/prompts/`): 7 prompt templates + variables.json extracted to
  JSON files. ankiconnect-server loads from these; anki-addon has its own copy (build step
  copies them).

- **Docs site** (`docs/`): Astro Starlight site. Pages: home, getting-started, usage,
  tailscale, architecture, anki-addon. GitHub Actions workflow deployed
  (`.github/workflows/docs.yml`).

- **Security**: Full audit completed. Bearer token auth on Express and add-on, CORS
  restrictions, Android localhost binding, deletion ownership checks, backslash escaping
  in search. See [security-audit.md](security-audit.md).

### What's Missing

- **No automated tests for web stack** -- no vitest/jest, no test script in package.json.
  The anki-addon has pytest tests but client/ and ankiconnect-server/ have zero tests.
- **GitHub Actions CI** -- docs deployment workflow exists but no test/lint CI pipeline yet.
- **Prompt sharing incomplete** -- ankiconnect-server reads from `shared/prompts/*.json`
  but anki-addon has its own copy. Android has prompts hardcoded in Kotlin.
- **Anki add-on not tested manually** -- code complete but needs manual testing inside
  Anki Desktop.

## Active Work Tracks

### 1. Web App Polish

See [next-steps.md](next-steps.md) for prioritized TODOs:
- Prompt testing end-to-end (lemmatization, mismatch badges)
- Disambiguation support, root word suggestions
- Unmarked sentence mode (auto-detect unknown words)

### 2. Testing Infrastructure

No plan doc yet. Key needs:
- Add vitest to web stack (client + ankiconnect-server)
- Priority test targets: card extraction, SSE parsing, auth middleware, API routes
- CI pipeline (GitHub Actions) for lint + typecheck + test

### 3. Anki Add-on Finalization

See [anki-addon.md](anki-addon.md). Remaining:
- Manual testing inside Anki Desktop
- Prompt template sharing (read from shared/prompts/ at build time)
- Potential AnkiWeb distribution

### 4. Android Future Work

See [android/PLANNING/future-features.md](../android/PLANNING/future-features.md).
Phases 1-5 complete. Phase 6 (shared prompts) and Phase 7 (quick-translate) are future.

## Plan Documents

| Doc | Summary | Status |
|-----|---------|--------|
| [next-steps.md](next-steps.md) | Web app feature TODOs | Active |
| [anki-addon.md](anki-addon.md) | Anki Desktop add-on plan | Phases 1-5 done, 6 done |
| [security-audit.md](security-audit.md) | Security findings and fixes | 7/9 fixes done |
| [prompt-design.md](prompt-design.md) | Prompt template design | Done (shared/prompts/) |
| [overview.md](overview.md) | WebView architecture + phase plan | Reference |
| [architecture.md](architecture.md) | Data flow diagram | Reference |
| [repo-structure.md](repo-structure.md) | Monorepo layout | Reference |
| [progress.md](progress.md) | What's been built | Reference |
| [team-workflow.md](team-workflow.md) | Coordinator playbook for multi-agent work | Reference |

### Completed (kept for reference)

| Doc | Summary |
|-----|---------|
| [migration.md](migration.md) | Monorepo merge (Phase 1) |
| [frontend-changes.md](frontend-changes.md) | Frontend platform awareness (Phase 3) |
| [webview-bridge.md](webview-bridge.md) | WebView + native bridges (Phases 4-5) |
| [claude-md-strategy.md](claude-md-strategy.md) | CLAUDE.md hierarchy design |
| [settings-design.md](settings-design.md) | Android settings design |

## How to Use This Directory

- **Before starting work**: Read this INDEX and the relevant plan doc.
- **When you finish a task**: Update the plan doc's status and this INDEX.
- **When you discover new requirements**: Create a new `.md` file and add it here.
- **When you implement something**: Update DOCS/ files to reflect code changes.
- Keep plans focused -- one concern per document.
