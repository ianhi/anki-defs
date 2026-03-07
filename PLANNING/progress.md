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
- Mobile-friendly responsive UI

## Android App (android/)

### Done

- Native Compose UI with chat and settings screens (will be replaced by WebView)
- Gemini API integration with multi-turn conversation context
- AnkiDroid ContentProvider integration (decks, notes, duplicate detection)
- Custom "word2anki" 4-field note model with Basic fallback
- Share intent support (ACTION_SEND)
- 95 unit tests across 7 test classes, all passing
- Code quality: atomic state updates, Channel for one-shot events, clean layer boundaries

## Monorepo Migration (Phase 1)

### Done

- word2anki merged into android/ via git subtree (full history preserved)
- CLAUDE.md hierarchy: root + client/ + ankiconnect-server/ + shared/ + android/
- DOCS/ directories with file maps and API contract reference
- PLANNING/ directories with INDEX.md at each level
- .gitignore covers both Node.js and Android/Gradle
- Both projects build: `npm run check` passes, `./gradlew assembleDebug` succeeds
