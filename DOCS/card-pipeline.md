# Card Pipeline: JSON-First Card Generation

How a user's input becomes an Anki flashcard in a single LLM call.

## Two Input Modes

| Mode              | Trigger                      | Example Input                                     |
| ----------------- | ---------------------------- | ------------------------------------------------- |
| **Single word**   | No spaces, <30 chars         | `বাজার`                                           |
| **Focused words** | Sentence + highlighted words | Sentence: `ছেলেটা বাজারে যাচ্ছে`, Focus: `বাজারে` |

Sentence mode without highlights is **blocked** — the client disables send and shows a
hint to mark unknown words. Detection happens server-side in `chat.ts` and client-side
in `MessageInput.tsx`.

## Step-by-Step Flow

### 1. Input Classification (chat.ts)

The server classifies the input:

- **Single word**: no spaces, <30 chars → uses `single-word.json` prompt
- **Focused words**: `highlightedWords` array non-empty → uses `focused-words.json` prompt
- **Sentence without highlights** → returns error SSE event (blocked)

### 2. JSON Completion (one LLM call)

The server calls `ai.getJsonCompletion(systemPrompt, userMessage)` — a single
non-streaming call. The prompt instructs the LLM to return JSON directly.

**Single word** returns one object:

```json
{
  "word": "কাঁদা",
  "definition": "to cry, to weep",
  "banglaDefinition": "চোখ থেকে জল পড়া",
  "exampleSentence": "মেয়েটা **কাঁদছে**।",
  "sentenceTranslation": "The girl is crying.",
  "spellingCorrection": null
}
```

**Focused words** returns an array:

```json
[
  {
    "word": "বাজার",
    "definition": "market, bazaar",
    "banglaDefinition": "যেখানে জিনিস কেনা-বেচা হয়",
    "exampleSentence": "ছেলেটা **বাজারে** যাচ্ছে",
    "sentenceTranslation": "The boy is going to the market.",
    ...
  }
]
```

Key details:

- Target word is bolded with `**markers**` in `exampleSentence`
- For focused words, `exampleSentence` is always the user's original sentence
- `spellingCorrection` is optional — present only when the LLM detects a typo

### 3. JSON Parsing with Fault Tolerance

The server parses the JSON response:

1. Strip markdown code fences (` ```json ... ``` `)
2. `JSON.parse()` the result
3. On failure: single retry with healing prompt ("Fix this JSON: [raw]")
4. On second failure: send error SSE event

### 4. Card Preview Building (cardExtraction.ts)

`buildCardPreviews(cards, targetDeck, ankiResults)` checks each card's word
against Anki to set `alreadyExists`, and applies spelling corrections to the
example sentence if present.

### 5. SSE Events

The server sends events in order: `usage`, `card_preview` (per card), `done`.
No `text` events — the client shows a spinner until cards arrive.

### 6. Bolding on the Anki Card

When the user clicks "Add to Anki", the client calls `markdownBoldToHtml(sentence)`
which converts `**word**` to `<b>word</b>` for Anki HTML rendering, with proper
HTML escaping of non-bold parts.

Each card bolds only its own word. If two words are highlighted from the same
sentence, each card gets the full sentence with only its word bolded.

## Card Fields

| Standard Field   | Description                         | Anki Note Field (default) |
| ---------------- | ----------------------------------- | ------------------------- |
| Word             | Lemmatized dictionary form          | Bangla                    |
| Definition       | English meaning (under 10 words)    | Eng_trans                 |
| BanglaDefinition | Bangla definition (simple, concise) | Bangla_definition         |
| Example          | Example sentence with **bold** word | example sentence          |
| Translation      | English translation of example      | sentence-trans            |

Field mapping is configurable in Settings — maps standard field names to the
user's Anki note type field names.

## Retry with Context

When the AI gets a word wrong, the user can add English context via the
"Not right? Add context..." input below the card. This sends a `userContext`
field rendered into the prompt as `(User note: ...)`. Multiple retries stack
context with `; ` separators.

## Key Files

| File                                                       | Role                                                |
| ---------------------------------------------------------- | --------------------------------------------------- |
| `python-server/anki_defs/routes/chat.py`                   | Mode detection, JSON completion, SSE orchestration  |
| `python-server/anki_defs/services/card_extraction.py`      | `build_card_previews()` — Anki dedup, card building |
| `python-server/anki_defs/services/ai.py`                   | `get_json_completion()`, prompt loading/rendering   |
| `python-server/anki_defs/services/providers/gemini.py`     | Gemini JSON completion (`responseMimeType`)         |
| `python-server/anki_defs/services/providers/claude.py`     | Claude JSON completion                              |
| `python-server/anki_defs/services/providers/openrouter.py` | OpenRouter JSON completion                          |
| `client/src/components/CardPreview.tsx`                    | Card UI, add/undo/edit, retry-with-context          |
| `client/src/lib/utils.ts`                                  | `markdownBoldToHtml()`                              |
| `shared/prompts/*.json`                                    | Prompt templates with `{{variable}}` substitution   |
| `shared/prompts/variables.json`                            | Shared variables: preamble, outputRules, etc.       |
