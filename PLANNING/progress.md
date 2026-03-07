# Progress

## Completed

### Core Architecture

- Express server + React/Vite client monorepo with shared types
- SSE streaming for AI responses
- Three AI providers: Claude, Gemini, OpenRouter (all with streaming + token usage)
- AnkiConnect integration via `yanki-connect` (remote-capable over Tailscale)

### AI & Prompts

- System prompts for: single word, sentence, focused (highlighted) words, card extraction, define, analyze
- Detailed Bangla-specific prompt rules ported from original Claude skill:
  - Explicit lemmatization rules (nouns: drop case endings, verbs: convert to verbal noun)
  - Example sentence quality requirements (must be real sentences, not definitions)
  - Clean translation formatting (no grammar labels, no he/she slashes)
  - Spelling tolerance for common Bangla character confusions
  - Root word awareness
- Transliteration toggle in settings (off by default)

### Card Generation Pipeline

- Main AI streams word-by-word analysis, ends with lemmatized vocabulary list
- Gemini extracts structured card data (word, definition, example, translation) per word
- Lemma mismatch detection when the two AI calls disagree on dictionary form
- Anki duplicate checking: field-specific queries, checks both inflected and lemmatized forms

### Card Preview UI

- Card preview cards with word, definition, highlighted example sentence, translation
- Editable word and definition fields (inline editing with pencil icon)
- Lemma mismatch badge (blue) shows when AIs disagree, clickable to edit
- Re-lemmatize button (refresh icon) asks AI to re-check dictionary form with sentence context
- Duplicate warning badges: "In deck" (from Anki) and "In session" (from current session)
- Add to Anki / Queue for Anki (when Anki offline) with undo support
- Dismiss (skip) individual cards

### State Management

- Zustand stores with persistence for: chat messages, token usage, session cards, settings
- Chat history survives page refresh
- Token/cost tracking per response and cumulative in header

### Settings

- AI provider selection (Claude/Gemini/OpenRouter) with model dropdowns
- API key management per provider
- Default deck and note type selection (from Anki)
- AnkiConnect status indicator
- Transliteration toggle

### Infrastructure

- Vite dev server accessible over network (`host: true`) for Tailscale access
- Remote AnkiConnect support (laptop Anki at 100.80.156.30:8765)
- Request body size limit
- All code passes TypeScript strict mode, ESLint, Prettier
