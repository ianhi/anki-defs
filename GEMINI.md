# Gemini Instructions

See [AGENTS.md](./AGENTS.md) for detailed instructions on working with this codebase.

## Quick Reference

### Development

```bash
npm install          # Install dependencies
npm run dev          # Run both client and server
npm run check        # Run typecheck + lint + format check
```

### Key Directories

- `server/src/` - Express backend with TypeScript
- `client/src/` - React frontend with Vite
- `shared/` - Shared types

### Code Quality

All code must pass:

- TypeScript strict mode (`npm run typecheck`)
- ESLint (`npm run lint`)
- Prettier formatting (`npm run format:check`)
