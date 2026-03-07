# Shared Types Reference

All types are defined in `types.ts`. This is the API contract source of truth.

## Core Types

- `Message` -- Chat message (user/assistant, with optional card previews, analysis, token usage)
- `CardContent` -- Base flashcard data: word, definition, exampleSentence, sentenceTranslation
- `CardPreview` -- Extends CardContent with Anki check results (alreadyExists, lemmaMismatch, inflectedForm, originalLemma)
- `WordAnalysis` -- Single-word analysis (lemma, partOfSpeech, definition, examples, existsInAnki, noteId)
- `SentenceAnalysis` -- Sentence breakdown (originalSentence, translation, words: AnalyzedWord[])
- `AnalyzedWord` -- Per-word entry in sentence analysis (word, lemma, partOfSpeech, meaning, existsInAnki, noteId)

## Session & Anki Types

- `SessionCard` -- Extends CardContent with id, createdAt, noteId, deckName, modelName
- `PendingCard` -- Extends CardContent with id, createdAt, deckName, modelName (not yet in Anki)
- `SessionState` -- `{ cards: SessionCard[], pendingQueue: PendingCard[] }`
- `AnkiNote` -- Anki note record (noteId, modelName, tags, fields)
- `CreateCardParams` -- Params for creating a card (deck, model, word, definition, exampleSentence, sentenceTranslation, tags)

## SSE Event Types

Single discriminated union `SSEEvent` with uniform `{ type, data }` shape:

- `{ type: 'text', data: string }` -- Streamed text chunk
- `{ type: 'card_preview', data: CardPreview }` -- Card preview from AI
- `{ type: 'word_analysis', data: WordAnalysis }` -- Single-word analysis result
- `{ type: 'sentence_analysis', data: SentenceAnalysis }` -- Sentence breakdown result
- `{ type: 'usage', data: TokenUsage }` -- Token usage for the call
- `{ type: 'done', data: null }` -- Stream complete
- `{ type: 'error', data: string }` -- Error message

## Settings

- `AIProvider` -- `'claude' | 'gemini' | 'openrouter'`
- `Settings` -- Full settings (aiProvider, API keys, geminiModel, openRouterModel, showTransliteration, defaultDeck, defaultModel, ankiConnectUrl)
- `DEFAULT_SETTINGS` -- Const with sensible defaults for all Settings fields
- `MODEL_PRICING` -- `Record<string, { input, output }>` per-million-token USD pricing

## Request Types

- `ChatStreamRequest` -- `{ messages, newMessage, deck?, highlightedWords? }`
- `DefineRequest` -- `{ word, deck? }`
- `AnalyzeRequest` -- `{ sentence, deck? }`
- `SearchNotesRequest` -- `{ query }`
- `CreateNoteRequest` -- `{ deckName, modelName, fields, tags? }`
- `RelemmatizeRequest` / `RelemmatizeResponse` -- Re-check dictionary form with context

## Other

- `TokenUsage` -- Token counts (inputTokens, outputTokens) + provider + model
