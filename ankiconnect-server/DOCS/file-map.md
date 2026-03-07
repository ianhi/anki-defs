# Server File Map

## Entry Point

- `src/index.ts` -- Express app entry, middleware, static serving, route registration

## Routes (`src/routes/`)

- `chat.ts` -- SSE streaming endpoint, input classification, card extraction pipeline; also non-streaming endpoints: /define, /relemmatize, /analyze
- `anki.ts` -- AnkiConnect proxy routes (decks, models, notes, search, status)
- `settings.ts` -- Settings CRUD (GET/PUT)
- `session.ts` -- Session card persistence (SQLite-backed)

## Types (`src/types/`)

- `index.ts` -- Re-exports from shared

## Services (`src/services/`)

- `ai.ts` -- Unified AI interface, system prompt templates, provider routing
- `claude.ts` -- Claude API streaming provider
- `gemini.ts` -- Gemini API streaming provider + structured card extraction
- `openrouter.ts` -- OpenRouter API streaming provider
- `anki.ts` -- AnkiConnect wrapper (`yanki-connect` method chaining)
- `cardExtraction.ts` -- Card extraction orchestration: parse AI response -> Anki duplicate check -> Gemini structured extraction -> lemma mismatch detection
- `settings.ts` -- Settings file management (`~/.config/bangla-anki/settings.json`)
- `session.ts` -- SQLite session store (better-sqlite3)

## Adding a New API Endpoint

1. Add route handler in `src/routes/`
2. Add types in `shared/types.ts`
3. Register route in `src/index.ts`
4. Client-side: add fetch wrapper in `client/src/lib/api.ts`

## Modifying AI Prompts

1. Edit system prompts in `src/services/ai.ts`
2. Update expected JSON response format if needed
3. Update types in `shared/types.ts` if response shape changes
