# Embedded Audio in Anki Cards

## Status

Implemented (2026-04-20). Google Cloud TTS generates MP3 audio during card creation
and stores it in Anki's media folder via AnkiConnect (python-server) or col.media
(addon). Audio is opt-in via `ttsEnabled` setting.

## Implementation

### Provider: Google Cloud Text-to-Speech

- Reuses the Gemini API key (same GCP project — user enables Cloud TTS API)
- REST endpoint: `POST texttospeech.googleapis.com/v1/text:synthesize?key=KEY`
- Output: MP3, 24 kHz sample rate, mono (~12 KB per word, ~40 KB per sentence)

### Format decision: MP3 only

OGG Opus would be smaller but is **broken on mobile**:

- AnkiDroid: Opus not supported (GitHub #3673, #9639)
- AnkiMobile iOS: OGG not supported at all (iOS only supports Opus in .caf container)
- MP3 is the only format universally supported across Anki Desktop, AnkiWeb,
  AnkiDroid, and AnkiMobile

### Architecture

```
create_card()
  → build_card_fields()              # existing, stays pure
  → _embed_audio(fields, ...)        # best-effort TTS + store
      → tts.synthesize(text, locale)  # Google Cloud TTS → MP3 bytes
      → store_media(fname, bytes)     # AnkiConnect or col.media
      → fields["WordAudio"] = "[sound:fname.mp3]"
  → addNote / col.add_note()         # existing
```

TTS failure logs a warning but never blocks card creation.

### Files

- `python-server/anki_defs/services/providers/tts.py` — Cloud TTS client (shared)
- `python-server/anki_defs/services/anki_connect.py` — `_store_media_file`, `_embed_audio`
- `anki-addon/services/anki_service.py` — `_generate_audio`, `_embed_audio`
- `python-server/anki_defs/services/routes/settings.py` — `GET /api/tts/check`
- `client/src/components/Settings.tsx` — TtsSection in Anki tab
- `client/src/lib/api.ts` — `ttsApi.check()`

### Audio fields populated

| Card type | Fields populated                   |
| --------- | ---------------------------------- |
| vocab     | `WordAudio`, `ExampleAudio`        |
| cloze     | `FullSentenceAudio`                |
| mcCloze   | `FullSentenceAudio`, `AnswerAudio` |

Distractor audio for mcCloze skipped for now (diminishing returns).

### Settings

- `ttsEnabled: boolean` — opt-in toggle (default: false)
- No separate TTS API key — reuses `geminiApiKey`
- `GET /api/tts/check` validates Cloud TTS access via `voices.list`

### Dedup

Filenames are deterministic: `anki-defs-{md5(text|locale)}.mp3`. Same text +
locale always produces the same filename, so re-adding a card doesn't create
duplicate media files.

### Size estimates

| Content                      | Duration | Size        |
| ---------------------------- | -------- | ----------- |
| Single word                  | ~2s      | ~8 KB       |
| Example sentence             | ~5s      | ~20 KB      |
| Word + sentence              | ~7s      | ~28 KB      |
| 50 cards/day (word+sentence) | —        | ~1.4 MB/day |
