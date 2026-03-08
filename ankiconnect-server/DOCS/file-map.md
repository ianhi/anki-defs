# Server File Map

## Entry Point

- `src/index.ts` -- Express app entry, middleware, static serving, route registration

## Routes (`src/routes/`)

- `chat.ts` -- SSE endpoint, input classification, JSON-first card pipeline (one LLM call); also /relemmatize
- `anki.ts` -- AnkiConnect proxy routes (decks, models, notes, search, status)
- `settings.ts` -- Settings CRUD (GET/PUT)
- `session.ts` -- Session card persistence (SQLite-backed)
- `prompts.ts` -- POST /api/prompts/preview: renders prompt templates without calling LLM (debug tool)

## Types (`src/types/`)

- `index.ts` -- Re-exports from shared

## Services (`src/services/`)

- `ai.ts` -- Unified AI interface: `getJsonCompletion()`, prompt loading/rendering, provider routing
- `claude.ts` -- Claude API provider (streaming + JSON completion)
- `gemini.ts` -- Gemini API provider (streaming + JSON completion with `responseMimeType`)
- `openrouter.ts` -- OpenRouter API provider (streaming + JSON completion)
- `anki.ts` -- AnkiConnect wrapper (`yanki-connect` method chaining)
- `cardExtraction.ts` -- `buildCardPreviews()`: maps LLM JSON cards to CardPreview with Anki dedup
- `settings.ts` -- Settings file management (`~/.config/bangla-anki/settings.json`)
- `session.ts` -- SQLite session store (better-sqlite3)

## Adding a New API Endpoint

1. Add route handler in `src/routes/`
2. Add types in `shared/types.ts`
3. Register route in `src/index.ts`
4. Client-side: add fetch wrapper in `client/src/lib/api.ts`

## Modifying AI Prompts

1. Edit prompt templates in `shared/prompts/*.json` (NOT in ai.ts)
2. Template variables (`{{preamble}}`, `{{outputRules}}`, `{{languageRules}}`, etc.) are defined in `shared/prompts/variables.json`
3. Variable substitution happens in `src/services/ai.ts` (`renderPrompt`)
4. Use `/api/prompts/preview` or the `?demo=prompts` debug page to test rendered output
5. Update types in `shared/types.ts` if response shape changes
