# Planning Index

## Current Status

All three backends are functional. All use JSON-first pipeline (single LLM call).

| Component | Status | Notes |
|-----------|--------|-------|
| Web app (`client/` + `ankiconnect-server/`) | Working | JSON-first pipeline, 3 AI providers, bearer auth, mobile UX |
| Android (`android/`) | Working | WebView + NanoHTTPd, still uses old two-call pipeline |
| Anki add-on (`anki-addon/`) | Code complete | Never manually tested inside Anki Desktop |
| Shared prompts (`shared/prompts/`) | Working | JSON-format templates, all backends load from shared |
| Tests | 149 vitest tests | Auth, session, settings, card extraction, prompts, AI, client hooks/utils |
| CI | Working | `.github/workflows/ci.yml` — typecheck + lint + format + tests |
| Docs site (`docs/`) | Deployed | Astro Starlight on GitHub Pages |

## Active Plans

| Doc | Summary | What's left |
|-----|---------|-------------|
| [next-steps.md](next-steps.md) | Feature roadmap | Prioritized TODO list |

## Reference (keep, don't modify)

| Doc | Purpose |
|-----|---------|
| [security-audit.md](security-audit.md) | Security findings — all 9 fixes implemented |
| [team-workflow.md](team-workflow.md) | Coordinator playbook for multi-agent work |
| [repo-structure.md](repo-structure.md) | Monorepo layout explanation |
| [anki-addon.md](anki-addon.md) | Add-on architecture (QTimer, zero deps) |
| [android-backend.md](android-backend.md) | NanoHTTPd server design |
| [quick-translate.md](quick-translate.md) | Future: native Android popup for quick defs |

## Subproject Planning

- `android/PLANNING/` — Android-specific plans and future features
- `client/PLANNING/` — Client-specific plans (currently empty)
- `ankiconnect-server/PLANNING/` — Server-specific plans (currently empty)
- `shared/PLANNING/` — Shared type plans (currently empty)

## For Agents

- **Read this file first**, then the relevant plan doc for your task.
- **Update docs in the same commit** as code changes.
- When a plan is **fully done**: delete the file and remove from this index.
- When you **discover new work**: create a `.md` and add it here.
