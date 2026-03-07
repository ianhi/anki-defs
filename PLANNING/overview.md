# Implementation Plan: Hybrid WebView Architecture

## Vision

Share anki-defs' React frontend between web and Android. The Android app runs a local HTTP server that implements the same API contract, backed by AnkiDroid ContentProvider + Gemini API. One UI, two backends.

## Status: IN PROGRESS (Phases 1-5 complete)

## Architecture

```
┌──────────────────────────────────────────────┐
│         client/ — React Frontend (shared)     │
│          calls relative /api/* URLs           │
│    shared/ — TypeScript types + prompt data   │
└───────────────────┬──────────────────────────┘
                    │
      ┌─────────────┼─────────────┐
      │             │             │
┌─────┴──────┐ ┌───┴────────┐ ┌──┴───────────┐
│ankiconnect-│ │ android/   │ │ anki-addon/  │
│  server/   │
│  Express   │ │ NanoHTTPd  │ │ Python       │
│ AnkiConnect│ │ContentProv.│ │Direct Anki DB│
│  Multi-AI  │ │ Gemini API │ │  Multi-AI    │
└────────────┘ └────────────┘ └──────────────┘
```

Three backends, one frontend. The API contract in `shared/types.ts` is the stable interface.
Each backend serves `client/dist/` and implements `/api/*` endpoints.

## Implementation Order

| Phase | Task                                              | Status   | Details                                    |
| ----- | ------------------------------------------------- | -------- | ------------------------------------------ |
| 1     | Repo restructure (monorepo)                       | **Done** | [migration.md](migration.md)               |
| 2     | Android backend: local HTTP server + API handlers | **Done** | [android-backend.md](android-backend.md)   |
| 3     | Frontend platform awareness (Android mode)        | **Done** | [frontend-changes.md](frontend-changes.md) |
| 4     | WebView Activity + asset bundling                 | **Done** | [webview-bridge.md](webview-bridge.md)     |
| 5     | Native bridges (share intents, permissions)       | **Done** | [webview-bridge.md](webview-bridge.md)     |
| 6     | Port prompt improvements to shared backend        | Planned  | [prompt-design.md](prompt-design.md)       |
| 7     | Quick-translate native popup (later)              | Future   | [quick-translate.md](quick-translate.md)   |

## Other Documents

| Doc                                            | Contents                                   |
| ---------------------------------------------- | ------------------------------------------ |
| [repo-structure.md](repo-structure.md)         | Monorepo layout, build system              |
| [claude-md-strategy.md](claude-md-strategy.md) | CLAUDE.md hierarchy for multi-agent work   |
| [anki-addon.md](anki-addon.md)                 | Future: Python backend inside Anki Desktop |

## Key Decisions

- Monorepo preferred over submodules (see [repo-structure.md](repo-structure.md))
- NanoHTTPd for local server (tiny, proven, Java)
- Frontend detects Android via `/api/platform` endpoint
- Quick-translate popup stays native Compose (speed matters)
