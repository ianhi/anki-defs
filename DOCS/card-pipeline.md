# Card Pipeline: Lemmatization, Highlighting, and Extraction

How a user's input becomes an Anki flashcard with the right word bolded.

## Three Input Modes

| Mode              | Trigger                          | Example Input                                     |
| ----------------- | -------------------------------- | ------------------------------------------------- |
| **Single word**   | No spaces, <30 chars             | `বাজার`                                           |
| **Sentence**      | Has spaces, no highlighted words | `ছেলেটা বাজারে যাচ্ছে`                            |
| **Focused words** | Sentence + highlighted words     | Sentence: `ছেলেটা বাজারে যাচ্ছে`, Focus: `বাজারে` |

Detection happens server-side in `ankiconnect-server/src/routes/chat.ts`.

## Step-by-Step Flow

### 1. AI Response (streaming)

The server selects a system prompt based on mode (`single-word.json`, `sentence.json`,
or `focused-words.json`) and streams the AI response via SSE.

For sentence/focused modes, the AI response includes a word-by-word analysis:

```
- **বাজারে** — in the market. From **বাজার**
- **যাচ্ছে** — is going. From **যাওয়া**
```

### 2. Inflected Form Extraction

After streaming completes, `extractInflectedForms()` parses the word-by-word section
to build a **lemma → inflected** map:

```
বাজার → বাজারে
যাওয়া → যাচ্ছে
```

This runs in **both** sentence and focused-words modes (not single-word mode, which
has no source sentence).

### 3. Card Data Extraction

For each word that needs a card, Gemini structured output extracts:

- **Single word mode**: `word` (lemma), `definition`, `exampleSentence`, `sentenceTranslation`
- **Sentence/focused modes**: `word` (lemma), `definition` only — the original sentence
  IS the example sentence (no AI-generated examples)

The extraction function (`extractCardDataFromSentence`) hardcodes the original sentence
and its translation into the card, only asking Gemini for the lemma and definition.

### 4. Card Preview Building

For each extracted card, the server determines the `inflectedForm` for bolding:

```typescript
const lemmaDiffers = cardData.word !== word; // word = input, cardData.word = Gemini's lemma

const inflected = lemmaDiffers
  ? word // input was inflected, use it directly
  : inflectedForms?.get(word) || // input was lemma, look up inflected form
    inflectedForms?.get(cardData.word) ||
    undefined;
```

#### Scenarios

**User highlights inflected form** (e.g., `বাজারে`):

- `word = "বাজারে"`, `cardData.word = "বাজার"` (lemmatized by Gemini)
- `lemmaDiffers = true` → `inflected = "বাজারে"` (the input itself)
- Card: word=বাজার, example sentence bolds বাজারে ✓

**User highlights lemma form** (e.g., `বাজার`):

- `word = "বাজার"`, `cardData.word = "বাজার"` (same)
- `lemmaDiffers = false` → looks up `inflectedForms.get("বাজার")` → `"বাজারে"`
- Card: word=বাজার, example sentence bolds বাজারে ✓

**User highlights word that IS the lemma in the sentence** (e.g., sentence uses `বাজার` directly):

- `word = "বাজার"`, `cardData.word = "বাজার"`
- `lemmaDiffers = false`, `inflectedForms` has no entry (inflected === lemma, skipped)
- `inflected = undefined` → client falls back to `currentWord` ("বাজার")
- `boldWordInSentence(sentence, "বাজার")` finds it directly ✓

**Sentence mode (no highlights)** — vocabulary extracted from AI response:

- `wordsForCards` comes from `extractVocabularyList()` — these are already lemmas
- `inflectedForms` maps lemma → inflected form from word-by-word analysis
- Same logic applies: looks up inflected form for bolding

### 5. Bolding on the Anki Card

When the user clicks "Add to Anki", the client calls:

```typescript
boldWordInSentence(preview.exampleSentence, preview.inflectedForm || currentWord);
```

This wraps the target word in `<b>` tags for Anki HTML rendering. It uses
case-insensitive substring matching (`indexOf`), so it finds the word even if
casing differs.

**Important**: Each card bolds only its own word. If two words are highlighted from
the same sentence, each card gets the full sentence with only its word bolded.

## Lemma Mismatch Badge

When Gemini's lemmatized form differs from the input word, the card shows a blue
"mismatch" badge (e.g., `বাজারে → বাজার`). The user can click it to edit the word,
or use the relemmatize button (🔄) to ask the AI for the correct dictionary form.

## Retry with Context

When the AI gets a word wrong (e.g., treats a colloquial word as a typo), the user
can add English context via the "Not right? Add context..." input below the card.
This sends a `userContext` field to the server, which renders it into the prompt
template as `(User note: ...)`. Multiple retries stack context with `; ` separators.

## Key Files

| File                                                | Role                                                |
| --------------------------------------------------- | --------------------------------------------------- |
| `ankiconnect-server/src/routes/chat.ts`             | Mode detection, prompt selection, SSE orchestration |
| `ankiconnect-server/src/services/cardExtraction.ts` | Inflected form extraction, card preview building    |
| `ankiconnect-server/src/services/gemini.ts`         | `extractCardData` / `extractCardDataFromSentence`   |
| `ankiconnect-server/src/services/ai.ts`             | Prompt loading, variable rendering (`renderPrompt`) |
| `client/src/components/CardPreview.tsx`             | Card UI, add/undo/edit, retry-with-context          |
| `client/src/lib/utils.ts`                           | `boldWordInSentence()`                              |
| `shared/prompts/*.json`                             | Prompt templates with `{{variable}}` substitution   |
| `shared/prompts/variables.json`                     | Shared variables: `preamble`, `outputRules`, `languageRules`, `transliteration` |
