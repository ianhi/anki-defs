# Planning Index

## Current Status

All three backends are functional. All use JSON-first pipeline (single LLM call).

| Component                                   | Status                 | Notes                                                                        |
| ------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| Web app (`client/` + `ankiconnect-server/`) | Working                | JSON-first pipeline, 3 AI providers, bearer auth, mobile UX, EN→BN mode      |
| Python server (`python-server/`)            | Phase 1-2 done         | FastAPI replacement for Express, 67 tests, shares service layer w/ addon     |
| Android (`android/`)                        | Working                | WebView + NanoHTTPd, still uses old two-call pipeline                        |
| Anki add-on (`anki-addon/`)                 | Code complete          | Never manually tested inside Anki Desktop                                    |
| Shared prompts (`shared/prompts/`)          | Working                | JSON-format templates incl. english-to-bangla, all backends load from shared |
| Tests                                       | 149 vitest + 67 pytest | Auth, session, settings, card extraction, prompts, AI, routes                |
| CI                                          | Working                | `.github/workflows/ci.yml` — typecheck + lint + format + tests               |
| Docs site (`docs/`)                         | Deployed               | Astro Starlight on GitHub Pages                                              |

### Recent additions (not yet reflected in test count)

- English → Bangla lookup mode (prefix `bn:` + auto-detect Latin, disambiguation via highlights)
- Concurrent streaming (type next prompt while previous processes)
- "Add All" button for multi-card responses
- Server-side token usage tracking (SQLite)
- History & search panel with indexed queries
- Token display dropdown (input/output breakdown + cost)

## Active Plans

| Doc                                                      | Summary                   | What's left                              |
| -------------------------------------------------------- | ------------------------- | ---------------------------------------- |
| [next-steps.md](next-steps.md)                           | Feature roadmap           | Prioritized TODO list                    |
| [python-server-migration.md](python-server-migration.md) | Replace Express w/ Python | Phase 5: switchover |

## Reference (keep, don't modify)

| Doc                                      | Purpose                                     |
| ---------------------------------------- | ------------------------------------------- |
| [security-audit.md](security-audit.md)   | Security findings — all 9 fixes implemented |
| [team-workflow.md](team-workflow.md)     | Coordinator playbook for multi-agent work   |
| [repo-structure.md](repo-structure.md)   | Monorepo layout explanation                 |
| [anki-addon.md](anki-addon.md)           | Add-on architecture (can bundle deps)       |
| [android-backend.md](android-backend.md) | NanoHTTPd server design                     |
| [quick-translate.md](quick-translate.md) | Future: native Android popup for quick defs |

## Subproject Planning

- `android/PLANNING/` — Android-specific plans and future features
- `client/PLANNING/` — Client-specific plans (currently empty)
- `ankiconnect-server/PLANNING/` — Server-specific plans (currently empty)
- `python-server/PLANNING/` — Python server plans
- `shared/PLANNING/` — Shared type plans (currently empty)

## For Agents

- **Read this file first**, then the relevant plan doc for your task.
- **Update docs in the same commit** as code changes.
- When a plan is **fully done**: delete the file and remove from this index.
- When you **discover new work**: create a `.md` and add it here.
