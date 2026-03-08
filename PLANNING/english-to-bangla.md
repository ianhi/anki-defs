# Plan: English → Bangla Lookup

**Status**: Design — needs discussion on detection strategy

## Goal

Let users type an English word or phrase and get the most natural Bangla equivalent back,
with the same card structure (word, definition, example, etc.) but reversed — the "word" is
Bangla and the "definition" is English, matching the existing Anki card format.

## Detection Strategy

Two options:

### Option A: Explicit prefix `en:` (recommended to start)

- User types `en:snatch` or `en:what does it matter`
- Client strips prefix, sets a flag (`mode: 'english-to-bangla'`)
- Server selects the `english-to-bangla.json` prompt
- No ambiguity, no false positives

### Option B: Auto-detect (can add later)

- Detect if input is Latin script (regex: `/^[a-zA-Z\s.,!?'"()-]+$/`)
- Risk: Romanized Bangla (e.g. "basha" meaning language) would be misclassified
- Could combine: auto-detect + let user override

**Recommendation**: Start with `en:` prefix. Add auto-detect later if the prefix feels clunky.

## Pipeline

1. **Client** (`MessageInput.tsx`): Detect `en:` prefix, strip it, pass `mode: 'english-to-bangla'`
   in the request body alongside `newMessage`
2. **Server** (`chat.ts`): When mode is `english-to-bangla`, use `english-to-bangla.json` prompt
3. **Prompt** (`shared/prompts/english-to-bangla.json`): New prompt that:
   - Takes an English word/phrase as input
   - Returns the most natural/common Bangla equivalent (not a literal translation)
   - Same JSON output schema as `single-word.json` (word, definition, banglaDefinition,
     exampleSentence, sentenceTranslation, spellingCorrection)
   - The `word` field should be the Bangla word
   - The `definition` field should be the English meaning
   - Should prefer colloquial/natural Bangla over formal/literary forms
4. **Prompt preview** (`prompts.ts`): Support the new mode so it's workshoppable
5. **Test cases** (`PromptPreview.tsx`): Add test cases for English → Bangla

## Prompt Design Notes

The prompt should instruct the LLM to:
- Find the most natural, commonly-used Bangla word for the English input
- Prefer spoken/colloquial forms over literary when both exist
- For phrases, find the idiomatic Bangla equivalent (not word-by-word translation)
- Handle multiple meanings: pick the most common, or ask the user to clarify
- Still return a Bangla example sentence with the word bolded

## Shared Types Changes

- Add `'english-to-bangla'` to ChatStreamRequest or add a `mode` field
- Minimal: just add optional `mode?: string` to ChatStreamRequest

## Files to Modify

| File | Change |
|------|--------|
| `shared/types.ts` | Add `mode?: string` to `ChatStreamRequest` |
| `shared/prompts/english-to-bangla.json` | New prompt file |
| `ankiconnect-server/src/routes/chat.ts` | Handle new mode |
| `ankiconnect-server/src/routes/prompts.ts` | Support new mode in preview |
| `ankiconnect-server/src/services/ai.ts` | Load new prompt |
| `client/src/components/MessageInput.tsx` | Detect `en:` prefix |
| `client/src/hooks/useChat.ts` | Pass mode to API |
| `client/src/lib/api.ts` | Add mode to stream params |
| `client/src/components/PromptPreview.tsx` | Add test cases |
