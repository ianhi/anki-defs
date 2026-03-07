# Planning Index (Root)

Cross-cutting plans and architecture decisions that span multiple subprojects.

## Active Plans

| Doc                                    | Status | Summary                                       |
| -------------------------------------- | ------ | --------------------------------------------- |
| [overview.md](overview.md)             | Active | Hybrid WebView architecture vision and phases |
| [migration.md](migration.md)           | Done   | Steps to merge word2anki into monorepo        |
| [repo-structure.md](repo-structure.md) | Done   | Monorepo layout and build system design       |

## Architecture

| Doc                                            | Summary                                  |
| ---------------------------------------------- | ---------------------------------------- |
| [architecture.md](architecture.md)             | Data flow diagram and AI call pattern    |
| [claude-md-strategy.md](claude-md-strategy.md) | CLAUDE.md hierarchy for multi-agent work |

## Feature Plans

| Doc                                        | Status  | Summary                                           |
| ------------------------------------------ | ------- | ------------------------------------------------- |
| [android-backend.md](android-backend.md)   | Planned | NanoHTTPd local server + API handlers for Android |
| [frontend-changes.md](frontend-changes.md) | Planned | Platform awareness for client/                    |
| [webview-bridge.md](webview-bridge.md)     | Planned | WebView setup, native bridges, share intents      |
| [prompt-design.md](prompt-design.md)       | Planned | Bangla-specific prompt rules and template design  |
| [settings-design.md](settings-design.md)   | Planned | Settings UI and storage design for Android        |
| [quick-translate.md](quick-translate.md)   | Planned | Native popup for ACTION_PROCESS_TEXT              |
| [anki-addon.md](anki-addon.md)             | Future  | Python backend inside Anki Desktop                |

## Tracking

| Doc                            | Summary                       |
| ------------------------------ | ----------------------------- |
| [progress.md](progress.md)     | Web app completed features    |
| [next-steps.md](next-steps.md) | Prioritized web app TODO list |

## How to Use This Directory

- Create a new `.md` file for each plan, requirement, or design proposal.
- Update this INDEX.md when adding or completing plans.
- Move completed plans to a "Done" status rather than deleting them.
- Keep plans focused -- one concern per document.
