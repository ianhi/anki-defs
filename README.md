# anki-defs

AI-powered vocabulary flashcard creator for [Anki](https://apps.ankiweb.net/). Type a word or paste a sentence, get definitions and example sentences from AI, and add them to Anki as flashcards with one click.

Built for Bangla language learning, but the architecture supports any language pair.

## How It Works

1. **Type a word or sentence** into the chat interface
2. **AI analyzes it** -- generates definitions, example sentences, and translations (streaming in real-time)
3. **Review card previews** -- edit the word, definition, or example before adding
4. **Add to Anki** -- cards are created in your Anki deck via AnkiConnect

The app detects whether your input is a single word, a full sentence, or contains highlighted words, and adjusts the AI prompt accordingly.

## Features

- **Multiple AI providers** -- Claude, Gemini, or OpenRouter (bring your own API key)
- **Real-time streaming** -- see the AI response as it's generated
- **Smart card extraction** -- AI extracts structured flashcard data from its own response
- **Duplicate detection** -- checks your Anki deck before adding, flags existing cards
- **Lemma handling** -- normalizes inflected forms to dictionary entries, detects mismatches
- **Editable previews** -- fix the word, definition, or example before committing
- **Session tracking** -- see all cards added this session, with undo support
- **Offline queue** -- queue cards when Anki isn't running, add them later
- **Chat persistence** -- conversation history survives page refresh

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Anki](https://apps.ankiweb.net/) with [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on installed
- An API key for at least one AI provider ([Claude](https://console.anthropic.com/), [Gemini](https://aistudio.google.com/app/apikey), or [OpenRouter](https://openrouter.ai/))

### Install and Run

```bash
git clone https://github.com/ianhi/anki-defs.git
cd anki-defs
npm install
npm run dev
```

Open http://localhost:5173, enter your API key in Settings, and start looking up words.

### AnkiConnect Setup

1. Install AnkiConnect in Anki: Tools > Add-ons > Get Add-ons > Code: `2055492159`
2. Restart Anki
3. The app connects to AnkiConnect at `localhost:8765` by default (configurable in Settings)

## Architecture

```
client/    React frontend (shared across all platforms)
shared/    TypeScript types -- API contract source of truth
server/    Node.js + Express backend (desktop/web)
android/   Kotlin Android app (AnkiDroid integration)
```

The React frontend doesn't know which backend it's talking to -- it just calls `/api/*` endpoints. This lets us share one UI across platforms:

- **Desktop/Web**: Express server proxies AI APIs and talks to Anki via AnkiConnect
- **Android** (in progress): Local HTTP server in-app, WebView loads the React frontend, talks to AnkiDroid via ContentProvider

## Development

```bash
npm run dev          # Run client + server with hot reload
npm run check        # TypeScript + ESLint + Prettier
```

For Android:

```bash
cd android
export ANDROID_HOME=~/Android/Sdk
./gradlew assembleDebug
```

See [CLAUDE.md](./CLAUDE.md) for architecture details and per-directory guides.

## Tech Stack

**Frontend**: React 19, Vite, Tailwind CSS v4, TanStack Query, Zustand

**Backend**: Express 5, TypeScript, SSE streaming, SQLite, yanki-connect

**Android**: Kotlin, Jetpack Compose, Gemini API, AnkiDroid ContentProvider

**AI**: Claude, Gemini, and OpenRouter -- unified streaming interface with structured card extraction
