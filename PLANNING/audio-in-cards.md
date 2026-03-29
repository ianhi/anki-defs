# Embedded Audio in Anki Cards

## Problem

The app has browser TTS for pronunciation, but Anki cards themselves have no audio.
Users reviewing cards on devices without good TTS (older Android, desktop without
voices installed, AnkiWeb) can't hear pronunciation. Embedding audio at card creation
time solves this — the audio travels with the card.

## Options

### Option A: Google Cloud TTS API

- High quality, supports bn-IN and bn-BD
- Cost: ~$4 per 1M characters ($0.000004/char). A typical word is ~5 chars = ~$0.00002
  per word. 1,000 words = ~$0.02. Very cheap.
- Requires API key (could reuse Gemini key if on same GCP project)
- Returns MP3/OGG/WAV
- Pros: best quality, consistent across all devices
- Cons: requires network, adds API dependency, small cost

### Option B: Browser TTS capture via MediaRecorder

- Use the existing SpeechSynthesis API + MediaRecorder to capture the audio
- No API cost, works offline
- Pros: free, uses the voice the user already selected
- Cons: quality depends on device voices, requires browser support for
  MediaRecorder + SpeechSynthesis combo (may not work on all browsers),
  recording is real-time (must wait for speech to finish)

### Option C: Gemini TTS (if available)

- Gemini API may support TTS in future versions
- Could bundle with the existing card generation call
- Not currently available for standalone TTS

## Recommended: Option A (Google Cloud TTS)

Best quality, negligible cost, and the user likely already has a GCP account
for the Gemini API key. Can be made optional — only generate audio if a TTS
API key is configured.

## Implementation sketch

### Backend

- New endpoint: `POST /api/tts` with `{ text, lang }` body
- Calls Google Cloud TTS API (or configurable provider)
- Returns audio as base64-encoded MP3
- Cache: store generated audio by text hash to avoid re-generating

### Card creation

- When creating a note, if TTS is enabled:
  1. Generate audio for the word
  2. Optionally generate audio for the example sentence
  3. Upload audio to Anki via AnkiConnect `storeMediaFile`
  4. Set the audio field in the note to `[sound:filename.mp3]`

### Settings

- TTS provider: None / Google Cloud / Browser capture
- TTS API key (if Google Cloud)
- Generate audio for: Word only / Word + sentence / Sentence only
- Audio field mapping: which Anki field gets the `[sound:...]` reference

### Anki note type

- User's note type needs an audio field (or we add one)
- The field mapping in Settings > Anki maps our "Audio" field to their field name
- AnkiConnect `storeMediaFile` stores the MP3 in Anki's media folder

## Complexity estimate

- Backend: ~100 lines (TTS endpoint + Google Cloud client)
- Frontend: ~50 lines (settings UI + pass audio flag to card creation)
- Field mapping: reuse existing pattern
- Testing: manual (generate card, verify audio plays in Anki)

## Dependencies

- Google Cloud TTS API access (or alternative provider)
- AnkiConnect `storeMediaFile` action
- Note type with an audio field
