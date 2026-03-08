# Client File Map

## Entry Points

- `src/main.tsx` -- React entry point
- `src/App.tsx` -- Main app component, layout
- `src/index.css` -- CSS entry with Tailwind v4 (`@theme` tokens, dark mode)
- `src/types/index.ts` -- Re-exports all types from `shared`

## Components (`src/components/`)

- `Chat.tsx` -- Primary chat interface
- `MessageList.tsx` -- Message rendering with markdown
- `MessageInput.tsx` -- Text input with word focus UI (preview chip, badges, Ctrl+B)
- `CardPreview.tsx` -- Flashcard preview with editing, add/skip/queue actions
- `Settings.tsx` -- Settings panel (AI provider, API keys, deck selection)
- `SessionCardsPanel.tsx` -- Session card history sidebar
- `HeaderDeckSelector.tsx` -- Deck selector in header
- `DebugMenu.tsx` -- Debug/dev tools
- `ui/` -- Base UI primitives (shadcn-style: Badge, Button, Card, Input, Label, Select)

## Hooks (`src/hooks/`)

- `useChat.ts` -- Chat state + SSE streaming logic (Zustand + persist)
- `useAnki.ts` -- TanStack Query hooks for Anki API calls
- `useSettings.ts` -- Zustand settings store (persisted)
- `useSessionCards.ts` -- Session card tracking + pending queue
- `useTokenUsage.ts` -- Token/cost accumulation

## Lib (`src/lib/`)

- `api.ts` -- API client functions (REST fetch wrappers + SSE connection)
- `focus.ts` -- Word focus/highlight logic (parse tokens, toggle `**` markers, cursor lookup)
- `utils.ts` -- Utility functions (`cn` for classnames, `generateId`, `boldWordInSentence`)

## Adding a New API Endpoint (Client Side)

1. Add fetch wrapper in `src/lib/api.ts`
2. Add TanStack Query hook in `src/hooks/`
3. Types come from `shared/types.ts` (imported as `shared`)
