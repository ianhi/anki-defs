---
name: language-flashcard-creator
description: Create Anki flashcards from pasted text with automatic definitions. Triggers when user pastes Bengali text (words or sentences), uses [[brackets]] to mark words, says "make cards"/"flashcard"/"add to anki", or asks word definitions. Auto-detects unknown words by checking existing deck. Requires Anki MCP server connection.
---

# Language Flashcard Creator

**⚠️ READ THIS ENTIRE SKILL FILE before creating cards.**

Create Anki flashcards from pasted text. Supports single words and sentences with marked vocabulary.

## CRITICAL: Note Type

**ALWAYS use note type `Bangla (and reversed)`** — NEVER use "Basic".

Fields (in order):

- `Bangla` — the word (lemmatized/dictionary form)
- `Eng_trans` — English translation (NO grammar labels, NO parenthetical notes)
- `example sentence` — A real Bengali SENTENCE using the word (NOT a definition)
- `sentence-trans` — English translation of the example sentence

**Example sentence must be an actual sentence**, not a definition or gloss:

```
✓ সে আমার <b>সমবয়সী</b>।  →  "She is my age."
✗ সমবয়সী - একই বয়সের  →  This is a definition, NOT a sentence
```

```javascript
// CORRECT
{
  type: "Bangla (and reversed)",
  deck: "Bangla::Immersion::thakurma jhuli",
  fields: {
    "Bangla": "কাঁদা",
    "Eng_trans": "to cry, to weep",
    "example sentence": "সে কাঁদতে লাগল।",
    "sentence-trans": "She started to cry."
  }
}

// WRONG - never do this
{
  type: "Basic",
  fields: { "Front": "...", "Back": "..." }
}
```

## Input Formats

**Single Bengali word**: Paste a word → create vocabulary card with auto-generated example sentence.

**English → Bengali lookup**: Prefix with `bangla:`, `bn:`, or `bengali:`

- Example: `bn: prince` → defines রাজপুত্র, offers to create card

**Marked sentence**: Use `[[double brackets]]` around target words → create cards for those words with sentence as example.

**Unmarked sentence**: Paste a sentence without brackets → Claude searches deck for each word and offers to create cards only for words NOT already in the deck. This is the easiest method for immersion reading.

Example:

```
User: রাজপুত্র সুন্দর ঘোড়ায় চড়ে

Claude: Checking your deck...
Found: সুন্দর ✓, ঘোড়া ✓
Not found: রাজপুত্র, চড়া

Create cards for unknown words?
- রাজপুত্র (prince)
- চড়া (to ride, to climb)
```

## Card Type Selection

**Vocabulary cards** (Bangla and reversed) — **DEFAULT**

- Creates 3 cards: recognition, production, listening
- Use for: learning new words
- This is what you want 95% of the time

**Cloze cards** (Cloze+) — only when explicitly requested

- Creates 1 card testing word in context
- Use for: grammar practice, testing specific forms
- Trigger with: "make a cloze", "cloze card for..."

## Triggering This Skill

In a new chat, any of these will work:

- Paste Bengali text (word or sentence)
- "make cards for [word]"
- "add to anki: [word]"
- "flashcard: [word]"
- "bn: [english word]" — look up Bengali translation
- "what does [Bengali word] mean?" (will offer to create card after defining)

## Mobile / Offline Mode (No Anki MCP)

When Anki MCP is unavailable (e.g., on phone), cards are queued in the conversation.

### How it works:

1. **Detect MCP availability**: Try to list decks. If fails → queue mode.

2. **Generate COMPLETE cards at queue time**: Do all the work upfront:
   - Lemmatize the word
   - Look up/verify definition
   - Generate example sentence and translation
   - Show the complete card to user for confirmation
   - Add fully-formed card to queue

3. **Proactive reminder**: When queue reaches 10+ cards, remind user to "save queue" in case conversation hits limit.

4. **Sync is just creation**: When user says "sync cards", simply create the pre-built cards. No content generation needed at sync time.

### Queue Format

Each queued card must be complete and ready to create:

```json
{
  "type": "Bangla (and reversed)",
  "deck": "Bangla::Immersion::thakurma jhuli",
  "fields": {
    "Bangla": "রাজপুত্র",
    "Eng_trans": "prince",
    "example sentence": "রাজপুত্র সুন্দর ঘোড়ায় চড়ে।",
    "sentence-trans": "The prince rides a beautiful horse."
  }
}
```

**At queue time, show the user:**

```
Queued: রাজপুত্র — prince
Example: রাজপুত্র সুন্দর ঘোড়ায় চড়ে।
         (The prince rides a beautiful horse.)
(Queue: 3 cards)
```

### With a Project (Optional)

A project can hold `known_vocabulary.txt` for offline word detection:

- Export from Anki (Browse → Select all → Export → Plain text, Bangla field only)
- Upload to project knowledge
- Claude checks this file to identify unknown words on mobile

### Without a Project (Simpler)

Works fine — just no automatic known-word detection:

- Claude queues all words you paste
- Stay in the same chat until you can sync
- Or say "save queue" to get JSON to paste elsewhere later

### Syncing Commands

**Prepare vocabulary file** (one-time, at laptop):

1. In Anki → Browse → select "Bangla" deck
2. Ctrl+A to select all
3. File → Export Notes → "Notes in Plain Text"
4. Include only the "Bangla" field
5. Save as `known_vocabulary.txt` and upload to project (if using one)

**Queue management**:

- "show queue" → list pending cards
- "save queue" → output JSON to copy/paste later
- "clear queue" → remove all pending
- "sync cards" → create all queued cards (requires Anki MCP)

**If conversation is getting long** (approaching limit):

- Say "save queue" to get JSON
- Copy to clipboard or notes app
- In new conversation: paste JSON and say "sync these cards"

**Restoring a saved queue**:

```
User: [pastes JSON]
sync these cards

Claude: Found 5 cards in pasted queue. Creating...
✓ Created all 5 cards.
```

## Workflow

1. **Check MCP availability**: Try to list decks. If fails → mobile/offline mode.
2. Parse input to detect format
3. **Lemmatize FIRST**: Convert to dictionary form (কাঁদতে → কাঁদা)
4. **Check for duplicates**: Search `Bangla:[lemmatized word]` in Anki
5. **If unmarked sentence**:
   - With MCP: search Anki deck for each word
   - Without MCP: search `known_vocabulary.txt` in project (if available)
6. **Spelling check**: Correct obvious typos in Bengali
7. **Define with verification**:
   - Common words: use Claude's knowledge
   - Uncommon/uncertain: web search to verify (Samsad, Wiktionary)
8. **Generate example sentence** if not provided (use original sentence if available)
9. **Create or queue** using `Bangla (and reversed)` note type — NEVER "Basic":
   - With MCP: create card immediately
   - Without MCP: add to queue, show running total
10. Confirm action

## Unknown Word Detection

For unmarked sentences, check if each word is known:

**With Anki MCP** (laptop):

1. Search exact form: `Bangla:বাজারে`
2. Search lemma: `Bangla:বাজার`
3. If either matches → word is known

**Without MCP** (mobile, using project):

1. Check `known_vocabulary.txt` for exact match
2. Check for lemma match
3. If found → word is known

**No MCP, no vocabulary file**:

- Assume all words are unknown
- Offer to queue all content words

Skip common particles that don't need cards: আমি, তুমি, সে, এই, ওই, না, হ্যাঁ, এবং, কিন্তু, etc.

## Example Sentences

**Always include an example sentence — a real sentence, NOT a definition.**

What is an example sentence:

- ✓ A complete Bengali sentence that uses the word naturally
- ✓ Shows how the word is used in context
- ✗ NOT a definition like "সমবয়সী - একই বয়সের"
- ✗ NOT a gloss like "সমবয়সী (same age)"

**If from a marked/unmarked sentence** → use that sentence
**If single word** → generate a simple, natural Bengali sentence:

- Keep it short (5-8 words)
- Use common vocabulary the learner likely knows
- Apply appropriate conjugation/case for natural context

Examples:

```
রাজপুত্র → "রাজপুত্র সুন্দর ঘোড়ায় চড়ে।" (The prince rides a beautiful horse.)
সমবয়সী → "সে আমার সমবয়সী।" (She is my age.)
কাঁদা → "মেয়েটা কাঁদছে।" (The girl is crying.)
```

**HTML formatting**: Only use `<b>` tags to highlight the target word. No other HTML (no `<ul>`, `<li>`, `<div>`, `<p>`, etc.).

✓ Correct: `আমি <b>বাজারে</b> যাব।`
✗ Wrong: `<ul><li><div>আমি <b>বাজারে</b> যাব।</div></li></ul>`

## Spelling Tolerance

Bengali has many similar-looking letters. Be generous with corrections:

- ব/ৰ confusion
- Missing/extra chandrabindu (ঁ)
- ণ/ন confusion
- শ/ষ/স confusion
- Similar conjuncts

When correcting, show the user: "Corrected spelling: [original] → [corrected]"

## Deck Selection

**Default**: `Bangla::Immersion::thakurma jhuli` (current reading)

Quick switches:

- "→ random" → `Bangla::random-vocab`
- "→ immersion" → `Bangla::Immersion`
- "→ bbc" → `Bangla::Immersion::BBC bangla`
- "→ youtube" → `Bangla::Immersion::Youtube`

If user mentions a different source, suggest appropriate subdeck or create new one under Immersion.

## Duplicate Checking

**ALWAYS check for existing cards before creating.** Search for the lemmatized form:

```
anki:search_notes with query: Bangla:কাঁদা
```

**If found, show the existing card's meaning** so user can decide:

- Same word, same meaning → true duplicate, warn user
- Same word, different meaning → homophone, OK to create (add disambiguation)

Example:

```
Found existing card for "তারা":
  → তারা = "Star ⭐" (bangla-disambig: মহাকাশ)

Is this the same word, or a different meaning?
- Same meaning → skip (already have it)
- Different meaning (e.g., "they") → create new card with disambiguation
```

## Lemmatization Rules

**ALWAYS convert to dictionary form before creating card.**

**Nouns**: Remove case endings

- বাজারে → বাজার (drop locative -এ/-তে)
- বাজারের → বাজার (drop genitive -র/-এর)
- বাজারকে → বাজার (drop accusative/dative -কে)

**Verbs**: Convert to verbal noun (not infinitive -তে form)

- কাঁদতে → কাঁদা (drop -তে, this is the dictionary form)
- যাব → যাওয়া (future 1st person → verbal noun)
- খাচ্ছি → খাওয়া (present continuous → verbal noun)
- করেছিল → করা (past perfect → verbal noun)

**In example sentence**: Keep original inflected form, use `<b>` to highlight

- Input: কাঁদতে
- Bangla field: কাঁদা
- example sentence: সে <b>কাঁদতে</b> লাগল।

## Note Type: Bangla (and reversed)

Default for vocabulary. Creates 3 cards: recognition, production, listening.

### Fields (in order of importance)

| Field            | Required | Content                                 |
| ---------------- | -------- | --------------------------------------- |
| Bangla           | ✓        | Target word in Bengali script           |
| Eng_trans        | ✓        | English translation/definition          |
| example sentence |          | Bengali sentence using the word         |
| sentence-trans   |          | English translation of example          |
| eng-disambig     |          | Hint on English→Bangla card (see below) |
| bangla-disambig  |          | Hint on Bangla→English card (see below) |
| type             |          | Part of speech                          |
| explanation      |          | Grammar notes, usage                    |
| image            |          | Image HTML                              |

### Disambiguation Fields

**eng-disambig**: Shown when English is ambiguous. Used on the production card (English front).
**Keep it minimal — a few words or emoji max.**

Examples from existing cards:

- আলো = "light" → eng-disambig: `lamplight 💡`
- পিঠ = "back" → eng-disambig: `body part`
- মাঠ = "field" → eng-disambig: `physical`
- বাবা = "father" → eng-disambig: `informal`
- পিতা = "father" → eng-disambig: `formal`
- পানি = "water" → eng-disambig: `🇧🇩`

**bangla-disambig**: Shown when Bengali word is a homonym. Written in Bengali. Used on recognition card (Bangla front).
**Keep it minimal — one or two Bengali words max.**

Examples from existing cards:

- তারা = "star" → bangla-disambig: `মহাকাশ`
- চিনি = "sugar" → bangla-disambig: `খাবার`
- হলুদ = "yellow" → bangla-disambig: `রং`
- বোঝা = "load" → bangla-disambig: `ভারী জিনিস`

**When to use**: Only when genuinely ambiguous. Most cards don't need it.

**Format rules**:

- ✓ `body part` or `💡` or `মহাকাশ`
- ✗ `This refers to the body part, not the direction`

### Example Creation

```javascript
create_note({
  deck: 'Bangla',
  type: 'Bangla (and reversed)',
  fields: {
    Bangla: 'বাজার',
    Eng_trans: 'market, bazaar',
    'example sentence': 'আমি বাজারে যাব।',
    'sentence-trans': 'I will go to the market.',
  },
});
```

## Note Type: Cloze+

For sentence-based cloze deletion cards. Simpler than Enhanced Cloze.

### Fields

| Field         | Required | Content                                      |
| ------------- | -------- | -------------------------------------------- |
| bangla        | ✓        | Sentence with `{{c1::word}}` cloze deletion  |
| english       | ✓        | English translation                          |
| full-sentence | ✓        | Complete sentence (no cloze) for TTS         |
| show-english  |          | "y" to show English on front, blank for hint |
| image         |          | Optional image                               |

### Example Cloze Creation

```javascript
create_note({
  deck: 'Bangla',
  type: 'Cloze+',
  fields: {
    bangla: 'আমি {{c1::বাজারে}} যাব।',
    english: 'I will go to the market.',
    'full-sentence': 'আমি বাজারে যাব।',
  },
});
```

## Definitions

Claude has native Bengali-English knowledge, but **should verify with web search** for:

- Less common words
- Words with multiple meanings
- Words where Claude is uncertain
- Any word the user questions

**Verification sources** (search in order of preference):

1. Samsad Bengali-English Dictionary
2. Wiktionary Bengali
3. Bengali language learning resources

When searching, use queries like:

- `"[word]" bengali meaning`
- `"[word]" সংসদ বাংলা`
- `"[word]" wiktionary bengali`

**Show your sources** when definitions come from web search. If Claude's initial definition differs from search results, prefer the search results and note the correction.

For very common words (মা, বাবা, খাওয়া, যাওয়া, etc.), Claude's native knowledge is usually reliable.

## Translation Formatting Rules

**Eng_trans field** — Keep it clean:

- Just the meaning, no grammatical labels in parentheses
- ✓ `aged, of age`
- ✗ `aged, of age (adjective suffix)`

Put grammatical info in the `type` or `explanation` field instead.

**Sentence translations** — No interspersed slashes:

- ✗ `He/She is my age / the same age as me.`
- ✓ `She is my age.` (pick one natural translation)
- ✓ Or two complete sentences: `He is my age. / She is the same age as me.`

For pronouns, just pick one (সে → "he" or "she", not "he/she").

## Word Families / Root Words

When defining a derived word (adjective, verb form, etc.), check if the root is also useful vocabulary:

**Example:**

```
User: bn: cute

Claude: **cute** in Bengali:

**আদুরে** (adure) — cute, pampered, lovable
  - From root: আদর (ador) = affection, love, care

Create flashcards?
1. আদুরে — cute, pampered ✓
2. আদর — affection, love (root word)

[both / just আদুরে / just আদর]
```

**When to offer root words:**

- Adjectives derived from nouns: আদুরে ← আদর
- Verbal nouns: শেখা (learning) ← শেখানো (to teach)
- Compound verbs: ভালোবাসা ← ভালো + বাসা
- Words with common prefixes/suffixes

**Don't offer roots for:**

- Very basic roots the learner likely knows (e.g., না, করা)
- Roots that aren't useful standalone vocabulary
- When root is already in the user's deck

## Example Interactions

### Single Bengali word (auto-generates example)

```
User: রাজপুত্র

Claude: **রাজপুত্র** (noun) — prince

Creating card:
- Bangla: রাজপুত্র
- Eng_trans: prince
- example sentence: <b>রাজপুত্র</b> সুন্দর ঘোড়ায় চড়ে।
- sentence-trans: The prince rides a beautiful horse.

Deck: Bangla::Immersion::thakurma jhuli
Create? [yes]
```

### English → Bengali lookup (with root word)

```
User: bn: cute

Claude: **cute** in Bengali:

**আদুরে** (adure) — cute, pampered, lovable
  - From root: আদর (ador) = affection, love, care

Create flashcards?
1. আদুরে — cute, pampered
2. আদর — affection, love (root word)

[both / 1 / 2]
```

### Unmarked sentence (auto-detect unknown words)

```
User: রাজপুত্র সুন্দর ঘোড়ায় চড়ে

Claude: Checking deck...
✓ সুন্দর (already have)
✓ ঘোড়া (already have)
✗ রাজপুত্র (not found)
✗ চড়া (not found)

Create 2 cards for unknown words?

1. **রাজপুত্র** — prince
2. **চড়া** — to ride, to climb

[yes to all / pick individually]
```

### Marked sentence (explicit selection)

```
User: আমি [[বাজারে]] যাব।

Claude: **বাজার** (noun) — market, bazaar

Creating card:
- Bangla: বাজার
- Eng_trans: market, bazaar
- example sentence: আমি <b>বাজারে</b> যাব।
- sentence-trans: I will go to the market.

Create?
```

### Verb extraction

```
User: সে [[খাচ্ছে]]।

Claude: **খাওয়া** (verb) — to eat

Creating card:
- Bangla: খাওয়া
- Eng_trans: to eat
- example sentence: সে <b>খাচ্ছে</b>।
- sentence-trans: She is eating.

Create?
```

### Mobile mode (no Anki available)

```
User: রাজপুত্র

Claude: **রাজপুত্র** (noun) — prince

[Anki not available - generating complete card for queue]

Queued:
- Bangla: রাজপুত্র
- Eng_trans: prince
- Example: <b>রাজপুত্র</b> সুন্দর ঘোড়ায় চড়ে।
- Translation: The prince rides a beautiful horse.

✓ Added to queue (3 cards total)
Say "sync cards" when back at your laptop.
```

### Syncing queued cards (just creates, no generation)

```
User: sync cards

Claude: Creating 3 queued cards...
✓ রাজপুত্র — prince
✓ চড়া — to ride, to climb
✓ রাজকুমারী — princess

Done! All 3 cards created.
Queue cleared.
```

### Restoring a saved queue (new conversation)

```
User: [pastes JSON from previous conversation]
sync these cards

Claude: Creating 5 cards from pasted queue...
✓ রাজপুত্র — prince
✓ চড়া — to ride, to climb
✓ রাজকুমারী — princess
✓ প্রাসাদ — palace
✓ সিংহাসন — throne

Done! All 5 cards created.
```

### Word needing disambiguation

```
User: তারা (the star one)

Claude: **তারা** — star (celestial body)

This is a homonym (also means "they"). Adding bangla-disambig: মহাকাশ

Create card?
```

### Uncommon word (with web verification)

```
User: আদুরে

Claude: [searches: "আদুরে" bengali meaning]

**আদুরে** (adjective) — pampered, spoiled, cherished; used for someone treated with excessive affection

Source: Samsad Bengali-English Dictionary

Creating card:
- Bangla: আদুরে
- Eng_trans: pampered, spoiled, cherished
- example sentence: সে মায়ের <b>আদুরে</b> সন্তান।
- sentence-trans: She is the mother's pampered child.

Create?
```

## Default Configuration

- **Deck**: `Bangla::Immersion::thakurma jhuli`
- **Note type**: `Bangla (and reversed)` — **NEVER use "Basic"**
- **Cloze note type**: `Cloze+` (only when explicitly requested)
