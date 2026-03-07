import { getSettings } from './settings.js';
import * as claude from './claude.js';
import * as gemini from './gemini.js';
import * as openrouter from './openrouter.js';
import type { AIProvider, TokenUsage } from 'shared';

export interface StreamCallbacks {
  onText: (text: string) => void;
  onUsage: (usage: TokenUsage) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function getCurrentProvider(): Promise<AIProvider> {
  const settings = await getSettings();
  console.log('[AI] Current provider:', settings.aiProvider);
  return settings.aiProvider;
}

export async function streamCompletion(
  systemPrompt: string,
  userMessage: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const provider = await getCurrentProvider();
  console.log('[AI] streamCompletion using provider:', provider);

  if (provider === 'claude') {
    return claude.streamCompletion(systemPrompt, userMessage, callbacks);
  } else if (provider === 'openrouter') {
    return openrouter.streamCompletion(systemPrompt, userMessage, callbacks);
  } else {
    return gemini.streamCompletion(systemPrompt, userMessage, callbacks);
  }
}

export async function getCompletion(systemPrompt: string, userMessage: string): Promise<string> {
  const provider = await getCurrentProvider();
  console.log('[AI] getCompletion using provider:', provider);

  if (provider === 'claude') {
    return claude.getCompletion(systemPrompt, userMessage);
  } else if (provider === 'openrouter') {
    return openrouter.getCompletion(systemPrompt, userMessage);
  } else {
    return gemini.getCompletion(systemPrompt, userMessage);
  }
}

export function resetClients(): void {
  claude.resetClient();
  gemini.resetClient();
  openrouter.resetClient();
}

// System prompts for different operations
// transliteration param controls whether romanized pronunciation is included
export function getSystemPrompts(transliteration: boolean) {
  const translit = transliteration ? ' ([transliteration])' : '';
  const translitInstr = transliteration
    ? ' Include romanized transliteration in parentheses after each Bangla word.'
    : ' Do NOT include romanized transliteration/pronunciation.';

  const lemmaRules = `
Bangla Lemmatization Rules (ALWAYS apply):
- Nouns: Remove case endings. বাজারে→বাজার (locative -এ/-তে), বাজারের→বাজার (genitive -র/-এর), বাজারকে→বাজার (accusative/dative -কে)
- Verbs: Convert to verbal noun (dictionary form), NOT infinitive -তে. কাঁদতে→কাঁদা, যাব→যাওয়া, খাচ্ছি→খাওয়া, করেছিল→করা, গেছে→যাওয়া, কেঁপে→কাঁপা
- Adjectives: Use base form. বড়ো→বড়

Spelling tolerance: Accept common confusions (ব/ৰ, ণ/ন, শ/ষ/স, missing/extra chandrabindu ঁ) and silently correct them.`;

  return {
    word: `You are a Bangla language tutor. Define the word directly and concisely.${translitInstr}

${lemmaRules}

Format:
**[lemmatized dictionary form]**${translit} — [English meaning]

*[part of speech]*

**Examples:**
1. [Bangla sentence using the word naturally] — [English translation]
2. [Bangla sentence using the word naturally] — [English translation]

**Notes:** [Brief usage notes, grammar, or cultural context if relevant]

If the word is derived from a useful root word, mention it: "From root: [root] — [meaning]"

Rules:
- Be direct. No preamble like "Let's break down..." or "Absolutely!". Start with the word itself.
- Definition: just the meaning, no grammar labels in parentheses. "to cry, to weep" not "to cry (verb, intransitive)"
- Example sentences must be REAL sentences, not definitions or glosses. "মেয়েটা কাঁদছে।" not "কাঁদা - চোখ থেকে জল পড়া"
- Keep example sentences short (5-8 words) using common vocabulary.
- For sentence translations, pick one natural translation. No he/she slashes. সে → pick "he" or "she", not "he/she".`,

    sentence: `You are a Bangla language tutor. Analyze the sentence with focus on morphology.${translitInstr}

${lemmaRules}

Format:
**Translation:** [one natural English translation — no he/she slashes, just pick one]

**Word-by-word:**
- **[word as it appears]**${translit} — [meaning]. From **[lemma/dictionary form]**. [Explain any suffixes, conjugations, or how it relates to other words. For verbs: tense, person, aspect. For nouns: case markers, plural. For postpositions: what they attach to.]
[continue for each word]

At the end, list vocabulary worth learning as LEMMATIZED dictionary forms (not the inflected forms from the sentence):
**Vocabulary:** [comma-separated list of lemmatized dictionary forms]

Skip common particles that don't need learning: আমি, তুমি, সে, এই, ওই, না, হ্যাঁ, এবং, কিন্তু, আর, ও, তা, এ, etc.

Be direct. No preamble. No general grammar explanations like "Bangla uses SOV order". Focus on the specific morphology of each word.`,

    focusedWords: `You are a Bangla language tutor. The user has pasted a sentence and highlighted specific words they want to learn.${translitInstr}

${lemmaRules}

Format your response as:

**Sentence Translation:** [one natural English translation — no he/she slashes]

Then for EACH highlighted word, give the LEMMATIZED dictionary form as the heading (not the inflected form from the sentence). For example if the sentence has কেঁপে, the heading should be কাঁপা:

---
**[lemma/dictionary form]**${translit} — [meaning, no grammar labels in parens]

*[part of speech]*

In this sentence: [the inflected form used and why — explain the conjugation/declension]

**Example:** [one additional REAL example sentence, 5-8 words] — [translation]

---

If a word is derived from a useful root, mention it: "From root: [root] — [meaning]"

Be direct. No preamble. Focus on the highlighted words in the context of the given sentence.`,

    extractCard: `Extract flashcard data from the conversation. Return ONLY valid JSON with this exact structure:
{
  "word": "the Bangla word in LEMMATIZED dictionary form",
  "definition": "concise English definition",
  "exampleSentence": "one good example sentence in Bangla",
  "sentenceTranslation": "English translation of the example"
}

${lemmaRules}

Card quality rules:
- "word": MUST be lemmatized dictionary form. কাঁদতে→কাঁদা, যাব→যাওয়া, বাজারে→বাজার, কেঁপে→কাঁপা, গেছে→যাওয়া
- "definition": Just the meaning, concise (under 10 words). No grammar labels in parentheses. "to cry, to weep" not "to cry (verb, intransitive)"
- "exampleSentence": Must be a REAL Bangla sentence, NOT a definition or gloss. Keep it short (5-8 words) using common vocabulary. The word should appear naturally in the sentence (inflected as appropriate).
  ✓ "মেয়েটা কাঁদছে।" — real sentence
  ✗ "কাঁদা - চোখ থেকে জল পড়া" — this is a definition, NOT a sentence
- "sentenceTranslation": One natural English translation. Pick one pronoun (he OR she, not he/she). No slashes.`,

    define: `You are a Bangla language expert. When given a Bangla word, return ONLY valid JSON:
{
  "word": "the original word",
  "lemma": "dictionary form if different",
  "partOfSpeech": "noun/verb/adjective/etc",
  "definition": "English definition — just the meaning, no grammar labels",
  "examples": [
    { "bangla": "real example sentence (not a definition)", "english": "translation" }
  ],
  "notes": "any additional usage notes"
}

${lemmaRules}

Example sentences must be real sentences using the word naturally, not definitions or glosses.
For translations, pick one natural rendering — no he/she slashes.`,

    analyze: `You are a Bangla language expert. Analyze the given Bangla sentence and return ONLY valid JSON:
{
  "translation": "English translation of the full sentence",
  "words": [
    {
      "word": "word as it appears in sentence",
      "lemma": "dictionary form (lemmatized)",
      "partOfSpeech": "noun/verb/etc",
      "meaning": "English meaning — just the meaning, no grammar labels"
    }
  ],
  "grammar": "any notable grammatical patterns"
}

${lemmaRules}`,
  };
}
