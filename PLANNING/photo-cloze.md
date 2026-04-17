# Photo Cloze Cards — Fill-in-the-Blank from Textbook Exercises

## Context

Users photograph textbook exercises with fill-in-the-blank sentences. Example:

```
1. ¿Dónde _____ (estar) María a las diez?
2. Nosotros _____ (celebrar) el cumpleaños.
3. Ella no _____ (saber) la respuesta.
```

These should become Anki cloze cards where the blank is the cloze deletion.

## Key challenges

### 1. The image may not contain the answer

Unlike vocab lists where the word+definition are both visible, cloze exercises
often show only the blank + an infinitive hint. The AI needs to:
- Extract the sentence with the blank
- Extract the hint (e.g. "estar", "saber") if present
- **Conjugate the verb correctly** based on context (subject, tense)

### 2. Conjugation ambiguity

The correct conjugation depends on tense, which may not be obvious:
- If the exercise section is labeled "Present tense", all answers are present
- If mixed tenses, the AI needs to infer from context
- Some exercises may be genuinely ambiguous

**Resolution strategy:**
- Extract any section heading / exercise title (e.g. "Presente indicativo")
  as a tense hint — pass it to the AI
- If no heading, ask the user to specify the tense before generation
- Show the AI's conjugation to the user for review before creating cards

### 3. Cloze hints in Anki

Anki cloze syntax supports hints: `{{c1::answer::hint}}`. If the textbook shows
an infinitive hint like `(saber)`, it should become the cloze hint:
- `Ella no {{c1::sabe::saber}} la respuesta.`

### 4. UI differences from vocab flow

The vocab flow shows word+definition pairs for review. Cloze needs a different
review UI:
- Show the full sentence with the blank highlighted
- Show the AI's answer (conjugated form)
- Show the hint (infinitive) if present
- Let user edit the answer if the conjugation is wrong
- Let user specify/override the tense

## Proposed architecture

### Phase 1: Extraction (new prompt)

New prompt: `shared/prompts/photo-cloze-extract.json`

Input: textbook exercise image
Output: JSON array:
```json
[
  {
    "sentence": "¿Dónde _____ María a las diez?",
    "hint": "estar",
    "answer": "está",
    "tense": "present indicative",
    "sentenceWithAnswer": "¿Dónde está María a las diez?",
    "translation": "Where is María at ten?"
  }
]
```

The AI fills in the blank, conjugating based on context + any tense heading
visible in the image. The prompt should instruct the AI to:
- Look for section headings indicating tense
- Infer tense from context if no heading
- Flag uncertain conjugations

### Phase 2: Review UI

New step in PhotoCapture (or a mode toggle) for cloze review:

```
[ ] ¿Dónde _____ María a las diez?
    Answer: está  (hint: estar)  [present indicative]
    Translation: Where is María at ten?
    [Edit answer] [Change tense]
```

Key UI elements:
- Sentence displayed with blank visible (not filled in — that's the answer)
- Answer shown separately so user can verify the conjugation
- Hint (infinitive) shown — will become `::hint` in cloze syntax
- Tense label — editable dropdown if the AI guessed wrong
- Edit button for the answer field
- Checkbox for selection (same pattern as vocab)

### Phase 3: Card generation

Unlike vocab cards (which need AI-generated example sentences), cloze cards
already have the sentence from the textbook. Generation is simpler:
- Build the cloze field: `¿Dónde {{c1::está::estar}} María a las diez?`
- Translation is already extracted
- No additional AI call needed (extraction does everything)

Use the existing `createNote` with `cardType: 'cloze'`.

### Phase 4: Tense handling

Options for tense input (in order of preference):
1. **AI reads it from the image** — section headings like "Presente indicativo"
2. **User specifies globally** — dropdown above the list: "These exercises are in: [present / preterite / imperfect / ...]"
3. **User edits per-sentence** — if tenses are mixed, edit individual answers

The extraction prompt should return a `tenseSource` field:
- `"heading"` — read from a visible heading in the image
- `"inferred"` — AI guessed from context
- `"unknown"` — genuinely ambiguous

When `tenseSource` is `"inferred"` or `"unknown"`, the UI should highlight the
tense label to prompt user verification.

## Shared types

```typescript
interface ClozeExtraction {
  sentence: string;         // With blank: "¿Dónde _____ María?"
  hint: string;             // Infinitive: "estar"
  answer: string;           // Conjugated: "está"
  tense: string;            // "present indicative"
  tenseSource: 'heading' | 'inferred' | 'unknown';
  sentenceWithAnswer: string; // Filled: "¿Dónde está María?"
  translation: string;
}

interface PhotoClozeExtractResponse {
  clozes: ClozeExtraction[];
  usage?: TokenUsage;
}
```

## Files to create/modify

### New
- `shared/prompts/photo-cloze-extract.json` — Vision prompt for cloze extraction
- Possibly `client/src/components/photo/ClozeReview.tsx` — Cloze-specific review UI

### Modified
- `shared/types.ts` — Add `ClozeExtraction`, `PhotoClozeExtractResponse`
- `python-server/anki_defs/services/ai.py` — Add `get_cloze_extraction()`
- `python-server/anki_defs/routes/photo.py` — Add `/api/photo/extract-cloze` endpoint
- `client/src/components/photo/PhotoCapture.tsx` — Add cloze mode toggle/detection
- `client/src/lib/api.ts` — Add `photoApi.extractCloze()`

### Reused as-is
- `browser-image-compression` for image handling
- FormData upload pattern
- `_helpers.py` for SSE/cost helpers
- `CardPreview` component (cloze cards already supported)
- Selection/checkbox UI pattern from vocab flow

## Open questions

1. **Auto-detect vocab vs cloze?** Could the extraction prompt detect whether the
   image is a vocab list or fill-in-the-blank exercise and route accordingly.
   Or: always show a mode toggle (Vocab / Cloze) in the extract step.

2. **Multiple blanks per sentence?** Some exercises have 2+ blanks. These should
   become `{{c1::...}}`, `{{c2::...}}` etc. within the same card.

3. **Exercises without hints?** Some blanks have no infinitive hint. The AI still
   needs to guess the word. These cloze cards would have no `::hint` suffix.

4. **Answer key on a different page?** If the answers are on a separate page, the
   user could photograph both. But that's a future enhancement — start with the
   AI conjugating from context.
