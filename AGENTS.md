# Agent Instructions for Bangla Vocabulary Learning App

This document provides instructions for AI agents working on this codebase.

## Project Overview

A local web application for Bangla vocabulary learning with:

- AI-powered definitions (Claude and Gemini)
- AnkiConnect integration for flashcard management
- Chat-like interface for word lookup and sentence analysis

## Tech Stack

### Backend (server/)

- **Express.js 5** - HTTP server and API routes
- **TypeScript** - Strict mode enabled
- **yanki-connect 3.x** - Typed AnkiConnect API client
- **@anthropic-ai/sdk** - Claude API integration
- **@google/genai** - Gemini API integration
- **SSE (Server-Sent Events)** - For streaming AI responses

### Frontend (client/)

- **Vite 6** - Build tool and dev server
- **React 19** - UI framework
- **Tailwind CSS v4** - Styling (using new @theme syntax)
- **TanStack Query 5** - Data fetching and caching
- **Zustand 5** - Lightweight state management

### Shared (shared/)

- Common TypeScript types shared between client and server

## Project Structure

```
anki-defs/
├── package.json              # Monorepo root (npm workspaces)
├── tsconfig.json             # Root TS config (strict mode)
├── eslint.config.js          # ESLint flat config
├── .prettierrc               # Prettier config
├── server/
│   ├── src/
│   │   ├── index.ts          # Express app entry
│   │   ├── routes/           # API route handlers
│   │   │   ├── anki.ts       # AnkiConnect proxy routes
│   │   │   ├── chat.ts       # AI chat with SSE streaming
│   │   │   └── settings.ts   # User settings CRUD
│   │   └── services/         # Business logic
│   │       ├── anki.ts       # AnkiConnect wrapper
│   │       ├── claude.ts     # Claude API service
│   │       ├── gemini.ts     # Gemini API service
│   │       ├── ai.ts         # Unified AI interface
│   │       └── settings.ts   # Settings file management
│   └── tsconfig.json
├── client/
│   ├── src/
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # Main app component
│   │   ├── components/       # React components
│   │   │   ├── ui/           # Base UI components (shadcn-style)
│   │   │   ├── Chat.tsx      # Main chat interface
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── CardPreview.tsx
│   │   │   ├── DeckSelector.tsx
│   │   │   └── Settings.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useChat.ts    # Chat state + SSE streaming
│   │   │   ├── useAnki.ts    # TanStack Query hooks
│   │   │   └── useSettings.ts # Zustand store
│   │   └── lib/
│   │       ├── api.ts        # API client functions
│   │       └── utils.ts      # Utility functions (cn)
│   ├── vite.config.ts
│   └── tsconfig.json
└── shared/
    └── types.ts              # Shared type definitions
```

## Development Commands

```bash
# Install dependencies
npm install

# Run development servers (both client and server)
npm run dev

# Run only server
npm run dev:server

# Run only client
npm run dev:client

# Type check all packages
npm run typecheck

# Lint all packages
npm run lint

# Format all files
npm run format

# Run all checks (typecheck + lint + format check)
npm run check
```

## Code Quality Rules

1. **TypeScript Strict Mode** - All code must pass strict type checking
2. **No unused variables** - `noUnusedLocals` and `noUnusedParameters` enabled
3. **Null safety** - `noUncheckedIndexedAccess` enabled
4. **ESLint** - Must pass linting with no errors
5. **Prettier** - Code must be formatted

## API Endpoints

### Anki Routes (`/api/anki`)

| Method | Endpoint               | Description                  |
| ------ | ---------------------- | ---------------------------- |
| GET    | `/decks`               | List all deck names          |
| GET    | `/models`              | List all note types          |
| GET    | `/models/:name/fields` | Get fields for a note type   |
| POST   | `/search`              | Search notes by query        |
| POST   | `/notes`               | Create a new note/card       |
| GET    | `/notes/:id`           | Get note details             |
| GET    | `/status`              | Check AnkiConnect connection |

### Chat Routes (`/api/chat`)

| Method | Endpoint   | Description                               |
| ------ | ---------- | ----------------------------------------- |
| POST   | `/stream`  | SSE endpoint for streaming AI responses   |
| POST   | `/define`  | Get definition for a word (non-streaming) |
| POST   | `/analyze` | Analyze sentence, identify unknown words  |

### Settings Routes (`/api/settings`)

| Method | Endpoint | Description                            |
| ------ | -------- | -------------------------------------- |
| GET    | `/`      | Get current settings (API keys masked) |
| PUT    | `/`      | Update settings                        |

## Key Implementation Patterns

### SSE Streaming

The chat endpoint uses Server-Sent Events for real-time streaming:

```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.write(`data: ${JSON.stringify(event)}\n\n`);
```

### AI Provider Switching

The `ai.ts` service provides a unified interface that delegates to either Claude or Gemini based on settings.

### AnkiConnect Integration

Uses `yanki-connect` with method chaining: `client.deck.deckNames()`, `client.note.findNotes()`, etc.

## Settings Storage

Settings stored in `~/.config/bangla-anki/settings.json`:

```json
{
  "aiProvider": "claude",
  "claudeApiKey": "sk-...",
  "geminiApiKey": "...",
  "defaultDeck": "Bangla Vocabulary",
  "defaultModel": "Basic",
  "ankiConnectUrl": "http://localhost:8765"
}
```

## TODO / Future Work

- [ ] Implement sentence analysis UI with word highlighting
- [ ] Add click-to-define for words in analyzed sentences
- [ ] Add conversation history persistence
- [ ] Add more card template customization
- [ ] Add import/export functionality

## Common Tasks for Agents

### Adding a new API endpoint

1. Add route handler in `server/src/routes/`
2. Add types in `shared/types.ts`
3. Add API client function in `client/src/lib/api.ts`
4. Add TanStack Query hook in `client/src/hooks/`

### Adding a new UI component

1. Create component in `client/src/components/`
2. Use existing UI primitives from `components/ui/`
3. Follow existing patterns (forwardRef, cn utility)
4. Add proper TypeScript types

### Modifying AI prompts

1. Edit system prompts in `server/src/services/ai.ts`
2. Update expected JSON response format if needed
3. Update types in `shared/types.ts` if response shape changes
