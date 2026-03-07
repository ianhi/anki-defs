# anki-defs

Turn any Bangla word or sentence into an Anki flashcard -- just type it in and let AI do the rest.

anki-defs uses AI to generate definitions, example sentences, and translations for Bangla vocabulary, then adds them directly to your Anki deck with one click. Built for Bangla-English learners, but the architecture supports any language pair.

<!-- TODO: Add screenshot/demo GIF here -->

## Features

- **Instant definitions** -- type a Bangla word and get a definition, example sentence, and English translation in seconds
- **Sentence analysis** -- paste a full sentence to get word-by-word breakdowns; highlight specific words with `**bold**` markers to focus on just those
- **Real-time streaming** -- see the AI response as it's generated, no waiting
- **One-click card creation** -- add cards to Anki directly from the preview, with the target word highlighted in the example sentence
- **Duplicate detection** -- checks your Anki deck before adding and warns you about existing cards
- **Smart lemmatization** -- normalizes inflected forms (e.g. "gechhe" to "jaoa") to their dictionary entry, and flags mismatches so you can fix them
- **Editable previews** -- edit the word, definition, or example before committing to Anki; re-lemmatize with one click if the AI got it wrong
- **Offline queue** -- queue cards when Anki is not running, sync them later
- **Session tracking** -- see all cards added this session in the sidebar, with undo support
- **Multiple AI providers** -- Claude, Gemini, or OpenRouter (bring your own API key)
- **Left-handed mode** -- moves action buttons to the left side of card previews
- **Anki sync button** -- trigger an AnkiConnect sync from the header so cards appear on your phone
- **Mobile-friendly** -- responsive design that works on any screen size
- **Chat persistence** -- conversation history survives page refresh

## Installation

### Web (quickest way to try it)

Requires [Node.js](https://nodejs.org/) 18+ and [Anki](https://apps.ankiweb.net/) with [AnkiConnect](https://ankiweb.net/shared/info/2055492159) installed.

```bash
git clone https://github.com/ianhi/anki-defs.git
cd anki-defs
npm install
npm run dev
```

Open http://localhost:5173, enter your API key in Settings, and start looking up words.

**AnkiConnect setup:** In Anki, go to Tools > Add-ons > Get Add-ons, enter code `2055492159`, and restart Anki. The app connects to AnkiConnect at `localhost:8765` by default.

### Anki Add-on (beta)

Runs inside Anki Desktop -- no AnkiConnect needed. See [anki-addon/README.md](anki-addon/README.md) for install instructions.

### Android

Coming soon. The Android app uses a WebView with the same React frontend and talks to AnkiDroid directly.

## Getting Started

1. **Add an API key.** Click the gear icon to open Settings. Choose an AI provider (Gemini is cheapest) and paste your API key.

2. **Select your deck.** Use the deck dropdown in the header to pick which Anki deck receives new cards. Your Anki note type and field mapping are configurable in Settings.

3. **Look up a word.** Type a Bangla word like `ভালোবাসা` and press Enter. The AI streams back a definition, example sentence, and translation.

4. **Add the card.** Click "Add to Anki" on the card preview. The card appears in your deck with the word highlighted in the example sentence.

## Usage

### Single word lookup

Type any Bangla word. The AI returns a definition, example sentence with the word in context, and an English translation.

### Sentence analysis

Paste a full Bangla sentence. The AI breaks it down word by word, explaining vocabulary and grammar.

To focus on specific words within a sentence, wrap them in `**double asterisks**` before sending. Only those words get card previews. You can also select text in the input box and press Ctrl+B to toggle highlighting.

### Editing card previews

Before adding a card, you can click the pencil icon to edit the word or definition inline. If the AI picked the wrong dictionary form, click the refresh icon to re-lemmatize -- the AI will suggest the correct base form.

A blue "mismatch" badge appears when the extraction lemma differs from the analysis lemma, letting you catch errors before they become cards.

### Session cards

Click the cards icon in the header to open the session sidebar. It shows every card you have added (or queued) this session. You can undo any added card or remove queued cards.

### Left-handed mode

Toggle in Settings. Moves the Add/Skip buttons to the left side of card previews for easier one-handed use on mobile.

### Sync button

When Anki is connected, a sync icon appears in the header. Click it to trigger an AnkiConnect sync so cards you just added on your laptop show up on your phone.

For a more detailed usage guide, see [docs/USAGE.md](docs/USAGE.md).

## Configuration

All settings are accessible via the gear icon in the header.

| Setting | Description |
|---------|-------------|
| AI Provider | Claude, Gemini, or OpenRouter |
| API Key | Your key for the selected provider |
| Gemini/OpenRouter Model | Choose a specific model (affects cost and quality) |
| Show transliteration | Include romanized pronunciation in definitions |
| Left-handed mode | Move action buttons to the left |
| Default Deck | Which Anki deck receives new cards |
| Default Note Type | Which Anki note type to use |
| Field Mapping | Map card data (Word, Definition, Example, Translation) to your note type's fields |

---

## Architecture (for contributors)

One React frontend, three backends. The frontend calls relative `/api/*` URLs and does not know which backend is serving it.

```
┌─────────────────────────────────────────────────────┐
│              client/ -- React Frontend              │
│         (shared by ALL platforms via /api/*)         │
│                                                     │
│   shared/ -- TypeScript types (API contract)        │
└────────────────────────┬────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
┌──────────┴───┐ ┌───────┴──────┐ ┌────┴───────────┐
│   server/    │ │  android/    │ │  anki-addon/   │
│              │ │              │ │                │
│  Express.js  │ │  NanoHTTPd   │ │  Python HTTP   │
│  AnkiConnect │ │ ContentProv. │ │  Direct Anki   │
│  Multi-AI    │ │  Gemini API  │ │  DB access     │
│              │ │              │ │                │
│ Desktop/Web  │ │   Android    │ │  Anki Desktop  │
└──────────────┘ └──────────────┘ └────────────────┘
```

- **Desktop/Web** (`server/`): Express server proxies AI APIs and talks to Anki via AnkiConnect
- **Android** (`android/`): Local HTTP server in-app, WebView loads the React frontend, talks to AnkiDroid via ContentProvider
- **Anki Add-on** (`anki-addon/`): Python backend running inside Anki's process with direct database access

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

For the Anki add-on:

```bash
cd anki-addon
uv sync --group dev
uv run ruff check . && uv run pyright && uv run pytest tests/ -v
```

See [CLAUDE.md](./CLAUDE.md) for architecture details and coding conventions.

## Tech Stack

**Frontend**: React 19, Vite, Tailwind CSS v4, TanStack Query, Zustand

**Backend**: Express 5, TypeScript, SSE streaming, SQLite, yanki-connect

**Android**: Kotlin, Jetpack Compose, Gemini API, AnkiDroid ContentProvider

**Anki Add-on**: Python (stdlib only), non-blocking socket server, direct Anki collection access

**AI**: Claude, Gemini, and OpenRouter with unified streaming interface and structured card extraction
