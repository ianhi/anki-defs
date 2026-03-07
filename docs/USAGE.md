# Usage Guide

This guide covers how to use anki-defs to create Bangla-English flashcards. For installation, see the [README](../README.md).

## First-time setup

Before you can look up words, you need two things: an AI provider API key and a connection to Anki.

### 1. Get an API key

anki-defs uses AI to generate definitions. You need an API key from at least one provider:

- **Gemini** (recommended to start): Free tier available. Get a key at https://aistudio.google.com/app/apikey
- **Claude**: High-quality definitions. Get a key at https://console.anthropic.com/
- **OpenRouter**: Access many models through one key, including free options. Sign up at https://openrouter.ai/

Open Settings (gear icon) and paste your key under the provider you chose.

### 2. Connect to Anki

**Web version:** Make sure Anki Desktop is running with AnkiConnect installed. The app checks the connection automatically -- you will see a green "Connected" badge in Settings when it works.

**Anki add-on version:** No setup needed. The add-on runs inside Anki and has direct access to your collection.

### 3. Choose your deck and note type

Use the deck dropdown in the header to select which deck receives new cards. In Settings, you can also choose a note type and configure which fields receive the word, definition, example, and translation.

The default field mapping targets the "Bangla (and reversed)" note type. If you use a different note type, adjust the mapping in Settings so each card data field (Word, Definition, Example, Translation) goes to the right note type field.

## Looking up words

### Single words

Type a Bangla word into the input box and press Enter (or tap the send button). The AI streams back:

- The dictionary form (lemma) of the word
- A concise English definition
- A natural Bangla example sentence using the word
- An English translation of the example sentence

A card preview appears below the AI's response. Click "Add to Anki" to create the card, or "Skip" to dismiss it.

**Example:** Type `ভালোবাসা` and get a definition like "love, affection" with an example sentence.

### Sentences

Paste a full Bangla sentence to get a word-by-word analysis. The AI explains vocabulary and grammar for each word in the sentence.

**Example:** Paste `আমি বাজারে যাচ্ছি` and the AI breaks down each word -- "আমি" (I), "বাজারে" (to the market, locative case of বাজার), "যাচ্ছি" (am going, present continuous of যাওয়া).

### Highlighted words in sentences

When you paste a sentence but only want cards for specific words, highlight those words before sending. There are two ways:

1. **Markdown bold**: Wrap words in `**double asterisks**`. For example: `আমি **বাজারে** যাচ্ছি` will only create a card for বাজার.

2. **Ctrl+B shortcut**: Select a word in the input box and press Ctrl+B (or Cmd+B on Mac) to toggle highlighting. Highlighted words appear with a yellow "Focus" indicator above the input.

The AI still analyzes the full sentence for context, but only the highlighted words get card previews.

## Working with card previews

### Adding cards

Each card preview shows the word, definition, example sentence (with the target word highlighted), and translation. Click "Add to Anki" to create the card in your selected deck.

After adding, a green "Added to [deck]" badge confirms success. You can click "Undo" to delete the card from Anki immediately.

### Duplicate detection

Before showing the "Add" button, anki-defs checks whether the word already exists in your Anki deck. If it does, a yellow "In deck" badge appears. You can still add the card -- click "Add to Anki" and confirm when prompted.

Cards added during the current session are also tracked. If you try to add the same word twice in one session, you will see an "In session" badge instead.

### Editing before adding

Click the pencil icon on any card preview to edit the word or definition inline. This is useful when:

- The AI used an uncommon romanization
- You want a shorter or more specific definition
- The lemma is wrong (e.g. the AI returned an inflected form instead of the dictionary form)

### Re-lemmatization

If the AI extracted the wrong dictionary form, click the refresh icon (next to the pencil in edit mode) to re-lemmatize. The AI tries again to find the correct base form, using the example sentence as context.

A blue "mismatch" badge appears automatically when the card extraction step finds a different lemma than the analysis step. This is a signal to review the word before adding.

### Offline queue

If Anki is not running when you want to add cards, they go into a pending queue instead. The button changes to "Queue for Anki" and queued cards show an orange "Pending" badge.

When Anki comes back online, open the Session Cards sidebar and click "Sync All" to push all queued cards to Anki at once.

## Session tracking

Click the cards icon (stacked layers) in the header to open the session sidebar. It shows:

- **Added cards**: Cards successfully in Anki, with an "In Anki" badge
- **Pending cards**: Cards queued while Anki was offline, with individual sync and delete buttons
- **Card count**: The header badge shows the total count, turning orange when pending cards exist

Use "Clear" to reset the session list (this does not delete cards from Anki).

## Tips for Bangla learners

### Inflected forms

Bangla verbs and nouns change form heavily. When you type an inflected form like `যাচ্ছি` (am going), the AI should return the dictionary form `যাওয়া` (to go). If it does not, use re-lemmatization to fix it.

Common inflection patterns to be aware of:
- Verb conjugations: `করা` -> `করছি`, `করেছি`, `করব`
- Noun case endings: `বাজার` -> `বাজারে` (locative), `বাজারের` (genitive)
- Adjective forms: the base form is usually what you want on the card

### Sentence context helps

Looking up a word from a sentence you are actually reading produces better results than looking up words in isolation. The AI uses the sentence context to pick the right meaning and generate a relevant example.

### Review your cards

anki-defs adds an `auto-generated` tag to every card it creates. You can search for `tag:auto-generated` in Anki's browser to find and review all AI-generated cards.

## How the AI prompt works

When you submit text, anki-defs detects the input type and picks the right prompt:

- **Single word**: Asks the AI for a definition, example, and translation
- **Full sentence**: Asks for a word-by-word breakdown with grammar notes
- **Sentence with highlights**: Analyzes the full sentence but focuses definitions on the highlighted words

After the AI responds, a second AI call extracts structured card data (word, definition, example, translation) from the response. This two-step approach produces better definitions than asking for structured output directly.

The AI is instructed to use natural, conversational Bangla in examples (not textbook Bangla), to provide transliteration when that setting is enabled, and to return the dictionary lemma form of each word.

## Troubleshooting

### "Disconnected" -- Anki is not connecting

1. Make sure Anki Desktop is open
2. Check that AnkiConnect is installed: Tools > Add-ons should list "AnkiConnect"
3. Restart Anki after installing AnkiConnect
4. AnkiConnect listens on port 8765 by default. If another program uses that port, you may need to change it in AnkiConnect's config

### API key errors

- **Claude**: Keys start with `sk-ant-`. Make sure you have not accidentally included extra spaces.
- **Gemini**: Keys start with `AI`. Get a new key at https://aistudio.google.com/app/apikey if yours stopped working.
- **OpenRouter**: Keys start with `sk-or-`. Check your account has credits if using paid models.

### Cards are not appearing in Anki

1. Check that you selected the right deck in the header dropdown
2. Check that your note type has the expected fields (open Settings to see the field mapping)
3. Look in Anki's browser for `tag:auto-generated` to see if the card was created under a different deck

### AI gives wrong definitions

Try a different model. Gemini 2.5 Flash and Claude generally perform well for Bangla. Free models on OpenRouter may struggle with less common vocabulary.

If a definition is wrong, edit it in the card preview before adding, or skip the card and re-submit the word.

### Streaming stops or errors

If the AI response cuts off, the error bar at the bottom shows what went wrong. Common causes:
- API rate limits (wait a moment and try again)
- Network issues
- The AI response was too long (try a simpler query)
