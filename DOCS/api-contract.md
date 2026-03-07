# API Contract Reference

Source of truth: `shared/types.ts`

## Endpoints

### Anki Routes (`/api/anki`)

| Method | Endpoint               | Description                  |
| ------ | ---------------------- | ---------------------------- |
| GET    | `/decks`               | List all deck names          |
| GET    | `/models`              | List all note types          |
| GET    | `/models/:name/fields` | Get fields for a note type   |
| POST   | `/search`              | Search notes by query        |
| POST   | `/notes`               | Create a new note/card       |
| GET    | `/notes/:id`           | Get note details             |
| GET    | `/status`              | Check AnkiConnect connection |

### Chat Routes (`/api/chat`)

| Method | Endpoint   | Description                              |
| ------ | ---------- | ---------------------------------------- |
| POST   | `/stream`  | SSE endpoint for streaming AI responses  |
| POST   | `/define`  | Get definition for a word                |
| POST   | `/analyze` | Analyze sentence, identify unknown words |

### Settings Routes (`/api/settings`)

| Method | Endpoint | Description                            |
| ------ | -------- | -------------------------------------- |
| GET    | `/`      | Get current settings (API keys masked) |
| PUT    | `/`      | Update settings                        |

### Session Routes (`/api/session`)

| Method | Endpoint     | Description              |
| ------ | ------------ | ------------------------ |
| GET    | `/cards`     | Get session card history |
| DELETE | `/cards/:id` | Remove card from session |

## SSE Event Types

The `/api/chat/stream` endpoint sends these discriminated union events:

- `content` -- Streamed text chunk from AI
- `card` -- Card preview data (word, definition, example, translation, duplicate status)
- `usage` -- Token usage and cost data
- `done` -- Stream complete
- `error` -- Error message

## Settings Storage

Settings stored in `~/.config/bangla-anki/settings.json`:

```json
{
  "aiProvider": "claude",
  "claudeApiKey": "sk-...",
  "geminiApiKey": "...",
  "defaultDeck": "Bangla Vocabulary",
  "defaultModel": "Basic",
  "ankiConnectUrl": "http://localhost:8765"
}
```
