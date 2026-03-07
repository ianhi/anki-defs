# Client -- React Frontend

Shared frontend for all platforms. Runs in browser (web) and WebView (Android).

## Tech Stack

- React 19, Vite 6, TypeScript strict mode
- Tailwind CSS v4 (new `@theme` syntax)
- TanStack Query 5 (data fetching/caching)
- Zustand 5 (state management)

## Key Files

- `src/App.tsx` -- Main app component, layout
- `src/components/Chat.tsx` -- Primary chat interface
- `src/components/MessageList.tsx` -- Message rendering with markdown
- `src/components/CardPreview.tsx` -- Flashcard preview + "Add to Anki"
- `src/components/Settings.tsx` -- Settings panel
- `src/components/SessionCardsPanel.tsx` -- Session card history
- `src/hooks/useChat.ts` -- Chat state + SSE streaming logic
- `src/hooks/useAnki.ts` -- TanStack Query hooks for Anki API
- `src/hooks/useSettings.ts` -- Zustand settings store
- `src/hooks/useSessionCards.ts` -- Session card tracking
- `src/lib/api.ts` -- API client functions (fetch wrappers)
- `src/lib/utils.ts` -- Utility functions (`cn` for classnames)
- `src/components/ui/` -- Base UI primitives (shadcn-style)

## Patterns

- **SSE streaming**: `useChat` opens an EventSource to `/api/chat/stream`, handles `content`, `card`, `done`, `error` events
- **State**: Zustand for settings, TanStack Query for server data, local state for chat
- **Styling**: Tailwind utility classes, `cn()` helper for conditional classes
- **Components**: Functional components, `forwardRef` for UI primitives

## Adding a New API Endpoint (Client Side)

1. Add fetch wrapper in `src/lib/api.ts`
2. Add TanStack Query hook in `src/hooks/`
3. Types come from `shared/types.ts` (imported as `@shared/types`)

## Boundaries

- **You own**: `client/` (React frontend)
- **You consume**: `shared/types.ts` (API contract -- do not modify without coordinating)
- **You do NOT touch**: `server/`, `android/`
- **Platform awareness**: Frontend must work in both browser and Android WebView. Use platform detection hook for conditional rendering -- never hardcode backend assumptions.
- If you need an API change, note it clearly in your output.

## Dev Commands

```bash
npm run dev:client    # Vite dev server only
npm run dev           # Client + server together (from repo root)
```

See root CLAUDE.md for code quality rules.
