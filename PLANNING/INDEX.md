# Planning Index

## Current Status

All backends use JSON-first pipeline (single LLM call). Python server is the primary backend.
Settings unified via shared `settings_base.py`. Structured logging throughout.

| Component                              | Status                           | Notes                                                                            |
| -------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Web app (`client/` + `python-server/`) | Working                          | FastAPI + React, 3 AI providers, TTS, cloze support, onboarding, tabbed settings |
| Android (`android/`)                   | Working                          | WebView + NanoHTTPd, still uses old two-call pipeline                            |
| Anki add-on (`anki-addon/`)            | Working                          | Hardened, keyring+fallback, needs manual testing inside Anki                     |
| Shared prompts (`shared/prompts/`)     | Working                          | Parameterized templates + language files in `shared/languages/`                  |
| Tests                                  | 65 vitest + 67 pytest + 46 addon | TypeScript + Python full coverage                                                |
| CI                                     | Working                          | `.github/workflows/ci.yml` — web checks + python-server checks                   |
| Docs site (`docs/`)                    | Deployed                         | Astro Starlight on GitHub Pages                                                  |

## Active Plans

| Doc                                                  | Summary             | What's left                                      |
| ---------------------------------------------------- | ------------------- | ------------------------------------------------ |
| [next-steps.md](next-steps.md)                       | Feature roadmap     | Reader mode, TTS polish, addon testing, and more |
| [cloze-research-prompt.md](cloze-research-prompt.md) | Cloze card research | Research complete, implementation in progress    |
| [audio-in-cards.md](audio-in-cards.md)               | Embedded card audio | Planning — Google Cloud TTS recommended          |

## Completed Plans (reference only)

| Doc                                                | Summary                         | Status |
| -------------------------------------------------- | ------------------------------- | ------ |
| [addon-hardening.md](addon-hardening.md)           | Post-migration cleanup & polish | DONE   |
| [settings-unification.md](settings-unification.md) | Shared keyring/consent/settings | DONE   |

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
- `python-server/PLANNING/` — Python server plans
- `shared/PLANNING/` — Shared type plans (currently empty)

## For Agents

- **Read this file first**, then the relevant plan doc for your task.
- **Update docs in the same commit** as code changes.
- When a plan is **fully done**: delete the file and remove from this index.
- When you **discover new work**: create a `.md` and add it here.
