# Shared -- API Contract Types

This directory defines the TypeScript types shared between the frontend and all backends.
`types.ts` is the source of truth for the API contract.

## Boundaries

- **You own**: `shared/` (type definitions)
- **Consumed by**: `client/`, `server/`, and `android/` (which re-implements the same API)
- Changes here affect ALL backends and the frontend
- After changes: run `npm run check` (web) and verify Android still builds

## Key Types

- `Message` -- Chat message (user/assistant, card previews, analysis)
- `CardContent` / `CardPreview` -- Flashcard data from AI responses
- `WordAnalysis` / `SentenceAnalysis` -- Structured AI analysis results
- SSE event types: `ContentEvent`, `CardEvent`, `DoneEvent`, `ErrorEvent`
- Settings types: `Settings`, `SettingsUpdate`
