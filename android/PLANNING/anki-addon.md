# Anki Desktop Add-on: Future Backend

## Concept
Package the React frontend + a Python backend as an Anki Desktop add-on. The add-on runs a local HTTP server inside Anki's Python environment, with direct access to Anki's database — no AnkiConnect needed.

## How Anki Add-ons Work
- Add-ons are Python packages in `~/.local/share/Anki2/addons21/<id>/`
- They run inside Anki's Python process (PyQt6)
- Full access to `anki` and `aqt` modules (collection, models, notes, decks)
- Can register menu items, open dialogs, run web servers

## Architecture
```
Anki Desktop process (Python/PyQt6)
├── Add-on loaded on startup
│   ├── Starts Flask/aiohttp server on localhost:PORT
│   ├── Serves React frontend from add-on assets
│   └── API handlers use anki.collection directly:
│       ├── /api/anki/decks    → col.decks.all_names()
│       ├── /api/anki/notes    → col.add_note()
│       ├── /api/anki/search   → col.find_notes()
│       └── /api/chat/*        → AI API calls (requests library)
└── Menu item: "word2anki" opens browser to localhost:PORT
```

## Advantages Over AnkiConnect
- **No external dependency** — AnkiConnect is a separate add-on users must install
- **Direct DB access** — faster, no HTTP overhead for Anki operations
- **Richer API** — can do things AnkiConnect doesn't expose
- **Single install** — user installs one add-on, gets everything

## Frontend Changes Needed
Same as Android: platform-aware rendering via `/api/platform` returning `{ platform: "anki-addon" }`.

| Setting | Web | Android | Anki Add-on |
|---------|-----|---------|-------------|
| AnkiConnect URL | Show | Hide | Hide |
| Deck selector | Via AnkiConnect | Via ContentProvider | Via col.decks |
| Permission flow | N/A | AnkiDroid permission | N/A (already inside Anki) |

## Implementation Notes
- Python backend would be a separate codebase (not Kotlin, not Node.js)
- Shares the React frontend and API contract
- AI calls: Use `requests` library for Gemini/Claude APIs
- Prompt templates: Would need to be ported to Python OR extracted as JSON config shared across backends
- Flask is commonly used in Anki add-ons for local servers

## Prompt Sharing Strategy
To avoid duplicating prompt logic across 3 backends (Node.js, Kotlin, Python):
- **Option A:** Extract prompts into JSON/YAML files in `web/shared/prompts/`
  - Each backend reads the same files
  - Prompts are data, not code
- **Option B:** Canonical prompts live in the Node.js backend
  - Kotlin and Python backends copy them at build time
  - Risk of drift

**Recommendation:** Option A — prompts as data files. They're already essentially strings with template variables.

## Priority: Future
This is beyond the current scope. Focus on Android first, then consider the add-on once the shared architecture is proven.
