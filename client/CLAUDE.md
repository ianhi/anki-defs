# Client -- React Frontend

Shared frontend for all platforms. Runs in browser (web) and WebView (Android).

## Tech Stack

- React 19, Vite 6, TypeScript strict mode
- Tailwind CSS v4 (new `@theme` syntax)
- TanStack Query 5 (data fetching/caching)
- Zustand 5 (state management)

## Patterns

- **SSE streaming**: `chatApi.stream` POSTs via `fetch()` and reads the response as a `ReadableStream`, manually parsing SSE lines through an async generator that yields discriminated `SSEEvent` types
- **State**: Zustand for settings/chat persistence, TanStack Query for server data
- **Styling**: Tailwind utility classes, `cn()` helper for conditional classes
- **Components**: Functional components, `forwardRef` for UI primitives

## Boundaries

- **You own**: `client/` (React frontend)
- **You consume**: `shared/types.ts` (API contract -- do not modify without coordinating)
- **You do NOT touch**: `ankiconnect-server/`, `android/`
- **Platform awareness**: Frontend must work in both browser and Android WebView. Use platform detection for conditional rendering -- never hardcode backend assumptions.
- If you need an API change, note it clearly in your output.

## Dev Commands

```bash
npm run dev:client    # Vite dev server only
npm run dev           # Client + server together (from repo root)
```

See root CLAUDE.md for code quality rules.
See `DOCS/` for file map and implementation details.
See `PLANNING/` for upcoming work and design proposals.
