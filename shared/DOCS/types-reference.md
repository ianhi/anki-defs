# Shared Types Reference

All types are defined in `types.ts`. This is the API contract source of truth.

## Core Types

- `Message` -- Chat message (user/assistant, with optional card previews, analysis, token usage)
- `CardContent` -- Base flashcard data: word, definition, exampleSentence, sentenceTranslation
- `CardPreview` -- Extends CardContent with Anki check results (alreadyExists, lemmaMismatch, inflectedForm)
- `WordAnalysis` -- Structured single-word analysis (lemma, partOfSpeech, definition, examples)
- `SentenceAnalysis` -- Structured sentence breakdown (words array with analysis per word)

## SSE Event Types

Discriminated union for `/api/chat/stream`:

- `ContentEvent` -- `{ type: 'content', content: string }`
- `CardEvent` -- `{ type: 'card', card: CardPreview }`
- `UsageEvent` -- `{ type: 'usage', usage: TokenUsage }`
- `DoneEvent` -- `{ type: 'done' }`
- `ErrorEvent` -- `{ type: 'error', error: string }`

## Settings Types

- `Settings` -- Full settings object (provider, API keys, deck, model, AnkiConnect URL)
- `SettingsUpdate` -- Partial settings for PUT endpoint

## Request/Response Types

- `RelemmatizeRequest` / `RelemmatizeResponse` -- Re-check dictionary form with context
- `TokenUsage` -- Token counts + cost per AI call
