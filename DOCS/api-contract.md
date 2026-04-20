# API Contract Reference

Source of truth: `shared/types.ts` (types), `shared/api-routes.json` (route list)

## Enforcement

Run `npm run check:api` (or `scripts/check-api-contract.sh` directly) to verify all
backends implement every required route. The script reads `shared/api-routes.json` and
greps each backend's route registration files. It exits non-zero if any required route
is missing and prints warnings for extra routes not in the contract.

## Endpoints

### Health Check

| Method | Endpoint              | Description                                                     |
| ------ | --------------------- | --------------------------------------------------------------- |
| GET    | `/api/health`         | Returns `{ status: 'ok' }`                                      |
| GET    | `/api/platform`       | Returns `{ platform: '...'}`                                    |
| GET    | `/api/anki/languages` | Returns `{ languages: [...] }` — available language definitions |

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

`POST /api/anki/notes` takes a **domain payload**, not a pre-built field map.
The server resolves the deck's language, ensures the matching auto-created
note type exists in Anki (creating it on first use via AnkiConnect's
`createModel`), and builds the field map from `shared/data/note-types.json`:

```json
{
  "deck": "Bangla",
  "cardType": "vocab", // "vocab" | "cloze" | "mcCloze"
  "word": "বাজার",
  "definition": "market",
  "nativeDefinition": "বাজার হলো...",
  "example": "আমি বাজারে যাচ্ছি",
  "translation": "I am going to the market",
  "vocabTemplates": {
    // optional; overrides settings default
    "recognition": true,
    "production": false,
    "listening": true
  },
  "tags": ["auto-generated"]
}
```

Response: `{ "noteId": 12345 }`.

Model names follow the pattern `${noteTypePrefix}-${languageCode}` for vocab,
with `-cloze` / `-mc-cloze` suffixes for the cloze variants — e.g.
`anki-defs-bn-IN`, `anki-defs-es-MX-cloze`. `{{LOCALE}}` in the template
strings is replaced with the Anki-style underscore form (`bn_IN`, `es_MX`)
taken from the language file's `ttsLocale` field.

Note creation uses `allowDuplicate: true` so users can add multiple cards for
the same word with different definitions.

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

### PDF Routes (`/api/pdf`)

PDF-to-cards pipeline. The client parses the PDF with pdfjs and sends
structural outline data; the server classifies and extracts via AI.

| Method | Endpoint   | Description                                                     |
| ------ | ---------- | --------------------------------------------------------------- |
| POST   | `/scout`   | Classify sections + link related (`PdfScoutRequest/Response`)   |
| POST   | `/extract` | SSE-stream `CardPreview`s for one section (`PdfExtractRequest`) |

`/extract` dispatches by `primary.contentType`:

- `vocab` / `glossary` → two-pass pipeline: `pdf-vocab-extract.json` for pairs,
  then `photo-generate.json` (reused) for full cards.
- `passage` → single-pass `pdf-passage-extract.json`. Supporting sections of
  type `glossary` or `vocab` are concatenated and passed as the glossary block.
- `exercise` → `pdf-cloze-extract.json` (maintained by the cloze agent).
  Returns 400 until that prompt file lands.

Tags on the request are attached to every emitted `CardPreview` via its
optional `tags` field, and flow through `CardPreview.extraTags` → addNote.

### Photo Cloze Routes (`/api/photo`)

In addition to the existing photo vocab extraction endpoint, these routes
support the two-stage cloze pipeline for textbook exercise photos.

| Method | Endpoint            | Description                                                        |
| ------ | ------------------- | ------------------------------------------------------------------ |
| POST   | `/cloze-transcribe` | Vision transcription of exercise image → plain text                |
| POST   | `/cloze-extract`    | Parse transcription into `ClozeItem[]` for cloze card creation     |

`/cloze-transcribe` accepts `multipart/form-data` with an `image` file field.
Returns `PhotoClozeTranscribeResponse`:

```json
{ "transcription": "1. Yo ___ al mercado. (ir)\n2. ...", "usage": { ... } }
```

`/cloze-extract` accepts JSON:

```json
{ "transcription": "1. Yo ___ al mercado. (ir)\n...", "deck": "Spanish" }
```

Returns `PhotoClozeExtractResponse`:

```json
{
  "items": [
    {
      "itemNumber": 1,
      "sentence": "Yo __1__ al mercado.",
      "blanks": [{ "answer": "voy", "hint": "(ir)", "category": "verb" }],
      "translation": "I go to the market.",
      "confidence": "high",
      "contextPreamble": null
    }
  ],
  "unsupported": ["5. (free-form question text)"],
  "usage": { ... }
}
```

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

- **Python server**: `~/.config/anki-defs/settings.json`
- **Anki addon**: Anki's addon config (`meta.json`)

API keys stored in system keyring when available, with fallback to config
file (requires user consent). See `settings_base.py` for shared logic.

Settings include language and auto-created note-type configuration:

```json
{
  "aiProvider": "gemini",
  "targetLanguage": "bn-IN",
  "deckLanguages": { "Spanish": "es-MX", "Languages::Hindi": "hi" },
  "customLanguages": [{ "code": "tl", "name": "Tagalog" }],
  "defaultCardTypes": ["vocab"],
  "vocabCardTemplates": {
    "recognition": true,
    "production": false,
    "listening": true
  },
  "noteTypePrefix": "anki-defs",
  ...
}
```

The legacy fields `defaultModel`, `fieldMapping`, `clozeNoteType`,
`clozeFieldMapping`, `mcClozeNoteType`, and `mcClozeFieldMapping` are gone:
on-disk settings are stripped of them when loaded (see `_migrate_settings`
in `settings_base.py`), and the client never sends model names or field
maps to the server anymore.

Language resolution for a deck walks the `::` hierarchy (e.g. `A::B::C` checks
`A::B::C`, then `A::B`, then `A`) before falling back to `targetLanguage`.
Languages can come from `shared/languages/*.json` files, `customLanguages`
setting, or be auto-generated from the language code.

`GET /api/anki/languages` returns the list of file-backed languages:

```json
{ "languages": [{ "code": "bn-IN", "name": "Bangla (India)", "nativeName": "বাংলা" }] }
```

Regional codes (e.g. `es-MX`) fall back to the bare language (`es`) if no
region-specific language file exists, and then to a generated default.
