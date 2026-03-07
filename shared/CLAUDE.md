# Shared -- API Contract Types

This directory defines the TypeScript types shared between the frontend and all backends.
`types.ts` is the source of truth for the API contract.

## Boundaries

- **You own**: `shared/` (type definitions)
- **Consumed by**: `client/`, `ankiconnect-server/`, and `android/` (which re-implements the same API)
- Changes here affect ALL backends and the frontend
- After changes: run `npm run check` (web) and verify Android still builds

See `DOCS/` for type reference and API endpoint details.
