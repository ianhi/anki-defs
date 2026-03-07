# Architecture

## Data Flow

```
User input (word/sentence + optional highlighted words)
    |
    v
Client (React) --- POST /api/chat/stream (SSE) ---> Server (Express)
    |                                                    |
    |                                                    v
    |                                           Classify input type
    |                                           (word / sentence / focused)
    |                                                    |
    |                                                    v
    |                                           Select system prompt
    |                                           (ai.ts getSystemPrompts)
    |                                                    |
    |                                                    v
    |  <-- SSE text chunks --                Stream to AI provider
    |                                        (Claude / Gemini / OpenRouter)
    |  <-- SSE usage --------                     |
    |                                             v (onDone)
    |                                        Parse AI response:
    |                                        - extractVocabularyList()
    |                                        - extractSentenceTranslation()
    |                                             |
    |                                             v
    |                                        Check Anki for each word
    |                                        (ankiService.searchWord)
    |                                             |
    |                                             v
    |                                        Extract card data per word
    |                                        (Gemini structured output)
    |                                             |
    |                                             v
    |                                        Re-check Anki for lemma mismatches
    |                                             |
    |  <-- SSE card_preview --               Send card previews
    |  <-- SSE done ----------               End stream
    v
Render card previews
(editable word/def, mismatch badges, add/skip/queue buttons)
    |
    v (user clicks Add)
POST /api/anki/notes ---> AnkiConnect ---> Anki
```

## AI Call Pattern

| Step | Provider | Prompt | Input | Output |
|------|----------|--------|-------|--------|
| 1 | User's choice | word/sentence/focusedWords | Raw user input | Streamed markdown analysis |
| 2..N | Always Gemini | extractCard (structured JSON) | Word + AI explanation + sentence | `{word, definition, exampleSentence, sentenceTranslation}` |
| Optional | User's choice | relemmatize | Word + sentence context | `{lemma, definition}` |

## Key Files

| File | Purpose |
|------|---------|
| `server/src/routes/chat.ts` | Main SSE endpoint, card extraction orchestration |
| `server/src/services/ai.ts` | System prompts, provider routing |
| `server/src/services/gemini.ts` | Gemini provider + structured card extraction |
| `server/src/services/claude.ts` | Claude provider |
| `server/src/services/openrouter.ts` | OpenRouter provider |
| `server/src/services/anki.ts` | AnkiConnect wrapper (search, create, delete) |
| `server/src/services/settings.ts` | Settings persistence (JSON file) |
| `client/src/hooks/useChat.ts` | Chat state (zustand + persist) |
| `client/src/hooks/useSessionCards.ts` | Session card tracking + pending queue |
| `client/src/hooks/useTokenUsage.ts` | Token/cost accumulation |
| `client/src/components/CardPreview.tsx` | Card preview UI with editing |
| `client/src/lib/api.ts` | API client (REST + SSE) |
| `shared/types.ts` | All shared TypeScript types |
