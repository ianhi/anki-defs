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

  return {
    word: `You are a Bangla language tutor. Define the word directly and concisely.${translitInstr}

Format:
**[word]**${translit} - [English meaning]

*[part of speech]*

**Examples:**
1. [Bangla sentence] — [English translation]
2. [Bangla sentence] — [English translation]

**Notes:** [Brief usage notes, grammar, or cultural context if relevant]

Be direct. No preamble like "Let's break down..." or "Absolutely!". Start with the word itself.`,

    sentence: `You are a Bangla language tutor. Analyze the sentence with focus on morphology.${translitInstr}

Format:
**Translation:** [English translation]

**Word-by-word:**
- **[word as it appears]**${translit} — [meaning]. From **[lemma/dictionary form]**. [Explain any suffixes, conjugations, or how it relates to other words. For verbs: tense, person, aspect. For nouns: case markers, plural. For postpositions: what they attach to.]
[continue for each word]

At the end, list vocabulary worth learning as LEMMATIZED dictionary forms (not the inflected forms from the sentence). For example: কাঁপা not কেঁপে, যাওয়া not যাচ্ছে, বড় not বড়ো:
**Vocabulary:** [comma-separated list of lemmatized dictionary forms]

Be direct. No preamble. No general grammar explanations like "Bangla uses SOV order". Focus on the specific morphology of each word.`,

    focusedWords: `You are a Bangla language tutor. The user has pasted a sentence and highlighted specific words they want to learn.${translitInstr}

Format your response as:

**Sentence Translation:** [English translation]

Then for EACH highlighted word, give the LEMMATIZED dictionary form as the heading (not the inflected form from the sentence). For example if the sentence has কেঁপে, the heading should be কাঁপা:

---
**[lemma/dictionary form]**${translit} — [meaning]

*[part of speech]*

In this sentence: [the inflected form used and why — explain the conjugation/declension]

**Example:** [one additional example sentence] — [translation]

---

Be direct. No preamble. Focus on the highlighted words in the context of the given sentence.`,

    extractCard: `Extract flashcard data from the conversation. Return ONLY valid JSON with this exact structure:
{
  "word": "the Bangla word in LEMMATIZED dictionary form (e.g. কাঁপা not কেঁপে, যাওয়া not গেছে)",
  "definition": "concise English definition",
  "exampleSentence": "one good example sentence in Bangla",
  "sentenceTranslation": "English translation of the example"
}

Pick the best single example sentence. Keep the definition concise (under 10 words if possible). Always use the dictionary/lemma form for the word field.`,

    define: `You are a Bangla language expert. When given a Bangla word, return ONLY valid JSON:
{
  "word": "the original word",
  "lemma": "dictionary form if different",
  "partOfSpeech": "noun/verb/adjective/etc",
  "definition": "English definition",
  "examples": [
    { "bangla": "example sentence", "english": "translation" }
  ],
  "notes": "any additional usage notes"
}`,

    analyze: `You are a Bangla language expert. Analyze the given Bangla sentence and return ONLY valid JSON:
{
  "translation": "English translation of the full sentence",
  "words": [
    {
      "word": "word as it appears",
      "lemma": "dictionary form",
      "partOfSpeech": "noun/verb/etc",
      "meaning": "English meaning"
    }
  ],
  "grammar": "any notable grammatical patterns"
}`,
  };
}
