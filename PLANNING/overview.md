# Implementation Plan: Hybrid WebView Architecture

## Vision

Share anki-defs' React frontend between web and Android. The Android app runs a local HTTP server that implements the same API contract, backed by AnkiDroid ContentProvider + Gemini API. One UI, two backends.

## Status: PLANNING

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
│  server/   │ │ android/   │ │ anki-addon/  │
│  Express   │ │ NanoHTTPd  │ │ Python       │
│ AnkiConnect│ │ContentProv.│ │Direct Anki DB│
│  Multi-AI  │ │ Gemini API │ │  Multi-AI    │
└────────────┘ └────────────┘ └──────────────┘
```

Three backends, one frontend. The API contract in `shared/types.ts` is the stable interface.
Each backend serves `client/dist/` and implements `/api/*` endpoints.

## Documents

| Doc                                            | Contents                                   |
| ---------------------------------------------- | ------------------------------------------ |
| [repo-structure.md](repo-structure.md)         | Monorepo layout, build system              |
| [frontend-changes.md](frontend-changes.md)     | Platform awareness for client/             |
| [android-backend.md](android-backend.md)       | Local HTTP server + API handlers           |
| [webview-bridge.md](webview-bridge.md)         | WebView setup, native bridges, intents     |
| [quick-translate.md](quick-translate.md)       | Native popup for ACTION_PROCESS_TEXT       |
| [anki-addon.md](anki-addon.md)                 | Future: Python backend inside Anki Desktop |
| [claude-md-strategy.md](claude-md-strategy.md) | CLAUDE.md hierarchy for multi-agent work   |
| [migration.md](migration.md)                   | Steps to migrate from current Compose app  |

## Implementation Order

| Phase | Task                                              | Effort |
| ----- | ------------------------------------------------- | ------ |
| 1     | Repo restructure (monorepo)                       | Small  |
| 2     | Android backend: local HTTP server + API handlers | Medium |
| 3     | Frontend platform awareness (Android mode)        | Small  |
| 4     | WebView Activity + asset bundling                 | Small  |
| 5     | Native bridges (share intents, permissions)       | Small  |
| 6     | Port prompt improvements to shared backend        | Medium |
| 7     | Quick-translate native popup (later)              | Medium |

## Key Decisions

- Monorepo preferred over submodules (see [repo-structure.md](repo-structure.md))
- NanoHTTPd for local server (tiny, proven, Java)
- Frontend detects Android via `/api/platform` endpoint
- Quick-translate popup stays native Compose (speed matters)
