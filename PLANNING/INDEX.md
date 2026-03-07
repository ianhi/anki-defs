# Planning Index

## Start Here

The project has three active work tracks:

1. **Android WebView migration** (Phases 1-5 complete) -- see [overview.md](overview.md)
   for the full phase plan. The Android app now uses a WebView loading the React frontend
   from a local NanoHTTPd server, with platform-aware settings and native bridges.

2. **Anki Desktop add-on** (Backend #3, Phases 1-5 implemented) -- see [anki-addon.md](anki-addon.md).
   Python add-on running inside Anki Desktop with direct collection access. Phase 6 (build
   system + packaging) still needed.

3. **Web app improvements** -- see [next-steps.md](next-steps.md) for prioritized TODOs
   (prompt testing, card field mapping, disambiguation, unmarked sentence mode).

## Phase Plan (Android WebView Migration)

| Phase | Task                                  | Status   | Plan Doc                                   |
| ----- | ------------------------------------- | -------- | ------------------------------------------ |
| 1     | Monorepo restructure                  | **Done** | [migration.md](migration.md)               |
| 2     | Android backend (NanoHTTPd + API)     | **Done** | [android-backend.md](android-backend.md)   |
| 3     | Frontend platform awareness           | **Done** | [frontend-changes.md](frontend-changes.md) |
| 4     | WebView Activity + asset bundling     | **Done** | [webview-bridge.md](webview-bridge.md)     |
| 5     | Native bridges (intents, permissions) | **Done** | [webview-bridge.md](webview-bridge.md)     |
| 6     | Port prompts to shared backend        | Planned  | [prompt-design.md](prompt-design.md)       |
| 7     | Quick-translate native popup          | Future   | [quick-translate.md](quick-translate.md)   |

## Web App TODOs

See [next-steps.md](next-steps.md) for the prioritized list. Key items:

- Prompt testing end-to-end (lemmatization, mismatch badges)
- Card field mapping (configurable note type fields)
- Unmarked sentence mode (auto-detect unknown words)
- Disambiguation support

## Architecture & Reference

| Doc                                            | Summary                                                        |
| ---------------------------------------------- | -------------------------------------------------------------- |
| [overview.md](overview.md)                     | WebView architecture vision + phase plan                       |
| [architecture.md](architecture.md)             | Data flow diagram and AI call pattern                          |
| [repo-structure.md](repo-structure.md)         | Monorepo layout and build system                               |
| [claude-md-strategy.md](claude-md-strategy.md) | CLAUDE.md hierarchy design                                     |
| [settings-design.md](settings-design.md)       | Android settings design                                        |
| [anki-addon.md](anki-addon.md)                 | Anki Desktop add-on backend (Phases 1-5 done, Phase 6 pending) |

## Completed

| Doc                                        | Summary                                       |
| ------------------------------------------ | --------------------------------------------- |
| [migration.md](migration.md)               | Monorepo merge (Phase 1) -- done              |
| [frontend-changes.md](frontend-changes.md) | Frontend platform awareness (Phase 3) -- done |
| [webview-bridge.md](webview-bridge.md)     | WebView + native bridges (Phases 4-5) -- done |

## Progress Tracking

- [progress.md](progress.md) -- What's been built (web + Android)

## How to Use This Directory

- **Before starting work**: Read this INDEX and the relevant plan doc.
- **When you finish a task**: Update the plan doc's status and this INDEX.
- **When you discover new requirements**: Create a new `.md` file and add it here.
- **When you implement something**: Update DOCS/ files to reflect code changes.
- Keep plans focused -- one concern per document.
