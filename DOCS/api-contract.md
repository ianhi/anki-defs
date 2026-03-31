# API Contract Reference

Source of truth: `shared/types.ts` (types), `shared/api-routes.json` (route list)

## Enforcement

Run `npm run check:api` (or `scripts/check-api-contract.sh` directly) to verify all
backends implement every required route. The script reads `shared/api-routes.json` and
greps each backend's route registration files. It exits non-zero if any required route
is missing and prints warnings for extra routes not in the contract.

## Endpoints

### Health Check

| Method | Endpoint        | Description                  |
| ------ | --------------- | ---------------------------- |
| GET    | `/api/health`   | Returns `{ status: 'ok' }`   |
| GET    | `/api/platform` | Returns `{ platform: '...'}` |
| GET    | `/api/languages` | Returns `{ languages: [...] }` — available language definitions |

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
| GET    | `/languages`           | List available languages     |

Note creation uses `allowDuplicate: true` so users can add multiple cards for the
same word with different definitions.

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

GET response includes `_keyringAvailable` (bool) and `_insecureStorageConsent` (bool).
PUT with secrets when keyring unavailable returns 409 until user consents.

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
| GET    | `/usage`               | Get token usage totals                         |
| POST   | `/usage/reset`         | Reset token usage counters                     |
| GET    | `/history`             | Search word history                            |

### Prompt Routes (`/api/prompts`)

| Method | Endpoint   | Description              |
| ------ | ---------- | ------------------------ |
| POST   | `/preview` | Preview rendered prompts |

## SSE Event Types

The `/api/chat/stream` endpoint sends discriminated union events (`SSEEvent` in `shared/types.ts`):

| `type`         | `data`        | Description                               |
| -------------- | ------------- | ----------------------------------------- |
| `card_preview` | `CardPreview` | Card preview with duplicate status        |
| `usage`        | `TokenUsage`  | Token usage and cost data                 |
| `done`         | `null`        | Stream complete                           |
| `error`        | `string`      | Error message (shown in assistant bubble) |

## Settings Storage

Settings are stored per-platform:

- **Python server**: `~/.config/bangla-anki/settings.json`
- **Anki addon**: Anki's addon config (`meta.json`)

API keys stored in system keyring when available, with fallback to config
file (requires user consent). See `settings_base.py` for shared logic.

Settings include cloze card configuration:

```json
{
  "aiProvider": "gemini",
  "targetLanguage": "bn",
  "deckLanguages": { "Spanish": "es", "Languages::Hindi": "hi" },
  "customLanguages": [{ "code": "tl", "name": "Tagalog" }],
  "defaultCardTypes": ["vocab"],
  "clozeNoteType": "",
  "clozeFieldMapping": {},
  "mcClozeNoteType": "",
  "mcClozeFieldMapping": {},
  ...
}
```

Language resolution for a deck walks the `::` hierarchy (e.g. `A::B::C` checks
`A::B::C`, then `A::B`, then `A`) before falling back to `targetLanguage`.
Languages can come from `shared/languages/*.json` files, `customLanguages`
setting, or be auto-generated from the language code.

`GET /api/anki/languages` returns the list of file-backed languages:
```json
{ "languages": [{ "code": "bn", "name": "Bangla", "nativeName": "বাংলা" }] }
```
