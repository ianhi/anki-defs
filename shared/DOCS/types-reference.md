# Shared Types Reference

All types are defined in `types.ts`. This is the API contract source of truth.

## Core Types

- `Message` -- Chat message (user/assistant, with optional card previews, token usage, refinements)
- `CardContent` -- Base flashcard data: word, definition, nativeDefinition, exampleSentence, sentenceTranslation
- `CardPreview` -- Extends CardContent with: alreadyExists, existingCard?, spellingCorrection?, tags? (PDF extract path)

## Session & Anki Types

- `SessionCard` -- Extends CardContent with id, createdAt, noteId, deckName, modelName
- `PendingCard` -- Extends CardContent with id, createdAt, deckName, modelName (not yet in Anki)
- `SessionState` -- `{ cards: SessionCard[], pendingQueue: PendingCard[] }`
- `AnkiNote` -- Anki note record (noteId, modelName, tags, fields)
- `CreateCardParams` -- Params for creating a card (deck, model, word, definition, nativeDefinition, exampleSentence, sentenceTranslation, tags)

## SSE Event Types

Single discriminated union `SSEEvent` with uniform `{ type, data }` shape:

- `{ type: 'card_preview', data: CardPreview }` -- Card preview from AI
- `{ type: 'text', data: string }` -- Markdown text response (e.g. sentence translation)
- `{ type: 'usage', data: TokenUsage }` -- Token usage for the call
- `{ type: 'done', data: null }` -- Stream complete
- `{ type: 'error', data: string }` -- Error message

## Settings & Models

- `AIProvider` -- `'claude' | 'gemini' | 'openrouter'`
- `CustomLanguage` -- `{ code, name }` for user-defined languages without .json prompt files
- `Settings` -- Full settings (aiProvider, API keys, geminiModel, openRouterModel, showTransliteration, leftHanded, defaultDeck, defaultModel, ankiConnectUrl, fieldMapping, apiToken, translationPrefix, targetLanguage, deckLanguages, customLanguages)
- `DEFAULT_SETTINGS` -- Const with sensible defaults for all Settings fields
- `CARD_DATA_FIELDS` -- `['Word', 'Definition', 'NativeDefinition', 'Example', 'Translation']`
- `FieldMapping` -- Maps card data fields to Anki note type field names
- `ModelOption` -- `{ value, label }` for model selector UI
- `GEMINI_MODELS` / `OPENROUTER_MODELS` -- Available model options per provider
- `MODEL_PRICING` -- `Record<string, { input, output }>` per-million-token USD pricing
- `computeCost(usage)` -- Calculate USD cost from TokenUsage

## Request Types

- `ChatStreamRequest` -- `{ newMessage, deck?, highlightedWords?, userContext?, mode?: 'english-to-target' }`
- `SearchNotesRequest` -- `{ query }`
- `CreateNoteRequest` -- `{ deckName, modelName, fields, tags? }`
- `RelemmatizeRequest` / `RelemmatizeResponse` -- Re-check dictionary form with context

## PDF-to-Cards

- `PdfContentType` -- `'vocab' | 'passage' | 'glossary' | 'exercise' | 'prose'`
- `PdfFontProfile` -- `{ sizePt, bold, indentPt, columns }` — layout cues for scout classification
- `PdfSection` -- structural: `{ id, heading, pageStart, pageEnd, bodySnippet, fontProfile }`. Produced by `client/src/lib/pdf.ts` from pdfjs.
- `ScoutedSection` -- `PdfSection` plus `{ contentType, suggestedTags, worthExtracting, confidence, relatedTo[] }`. LLM scout adds semantic fields and links related sections.
- `PdfScoutRequest` / `PdfScoutResponse` -- shape of `/api/pdf/scout`
- `PdfExtractRequest` -- `{ primary, supporting[], tags, deck? }`. Client resolves `relatedTo` into `supporting` before calling.

## Other

- `TokenUsage` -- Token counts (inputTokens, outputTokens) + provider + model
- `PlatformInfo` -- `{ platform: 'web' | 'android', ankiAvailable?, hasPermission? }`
