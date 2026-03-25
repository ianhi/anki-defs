# API Contract Reference

Source of truth: `shared/types.ts` (types), `shared/api-routes.json` (route list)

## Enforcement

Run `npm run check:api` (or `scripts/check-api-contract.sh` directly) to verify all
backends implement every required route. The script reads `shared/api-routes.json` and
greps each backend's route registration files. It exits non-zero if any required route
is missing and prints warnings for extra routes not in the contract.

## Endpoints

### Health Check

| Method | Endpoint      | Description                |
| ------ | ------------- | -------------------------- |
| GET    | `/api/health` | Returns `{ status: 'ok' }` |

### Anki Routes (`/api/anki`)

| Method | Endpoint               | Description                  |
| ------ | ---------------------- | ---------------------------- |
| GET    | `/decks`               | List all deck names          |
| GET    | `/models`              | List all note types          |
| GET    | `/models/:name/fields` | Get fields for a note type   |
| POST   | `/search`              | Search notes by query        |
| POST   | `/notes`               | Create a new note/card       |
| GET    | `/notes/:id`           | Get note details             |
| DELETE | `/notes/:id`           | Delete a note                |
| POST   | `/sync`                | Trigger Anki sync            |
| GET    | `/status`              | Check AnkiConnect connection |

### Chat Routes (`/api/chat`)

| Method | Endpoint       | Description                            |
| ------ | -------------- | -------------------------------------- |
| POST   | `/stream`      | SSE endpoint for AI card generation    |
| POST   | `/distractors` | Generate MC cloze distractors          |
| POST   | `/relemmatize` | Re-check the dictionary form of a word |

### Settings Routes (`/api/settings`)

| Method | Endpoint | Description                            |
| ------ | -------- | -------------------------------------- |
| GET    | `/`      | Get current settings (API keys masked) |
| PUT    | `/`      | Update settings                        |

### Session Routes (`/api/session`)

| Method | Endpoint               | Description                                    |
| ------ | ---------------------- | ---------------------------------------------- |
| GET    | `/`                    | Get full session state (cards + pending queue) |
| POST   | `/cards`               | Add a card to the session                      |
| DELETE | `/cards/:id`           | Remove a card from the session                 |
| POST   | `/pending`             | Add a card to the pending queue                |
| DELETE | `/pending/:id`         | Remove a card from the pending queue           |
| POST   | `/pending/:id/promote` | Sync pending card to Anki and move to cards    |
| POST   | `/clear`               | Clear all session data                         |

## SSE Event Types

The `/api/chat/stream` endpoint sends these discriminated union events (defined as `SSEEvent` in `shared/types.ts`):

| `type`         | `data`        | Description                        |
| -------------- | ------------- | ---------------------------------- |
| `card_preview` | `CardPreview` | Card preview with duplicate status |
| `usage`        | `TokenUsage`  | Token usage and cost data          |
| `done`         | `null`        | Stream complete                    |
| `error`        | `string`      | Error message                      |

No `text` events — the client shows a spinner until card previews arrive.

## Settings Storage

Settings stored in `~/.config/bangla-anki/settings.json`:

```json
{
  "aiProvider": "claude",
  "claudeApiKey": "sk-...",
  "geminiApiKey": "...",
  "geminiModel": "gemini-2.5-flash-lite",
  "openRouterApiKey": "...",
  "openRouterModel": "google/gemini-2.5-flash",
  "showTransliteration": false,
  "leftHanded": false,
  "defaultDeck": "Bangla",
  "defaultModel": "Bangla (and reversed)",
  "ankiConnectUrl": "http://localhost:8765",
  "fieldMapping": {
    "Word": "Bangla",
    "Definition": "Eng_trans",
    "BanglaDefinition": "bangla-def",
    "Example": "example sentence",
    "Translation": "sentence-trans"
  },
  "apiToken": "auto-generated-on-first-startup"
}
```
