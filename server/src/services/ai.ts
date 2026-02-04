import { getSettings } from './settings.js';
import * as claude from './claude.js';
import * as gemini from './gemini.js';
import type { AIProvider } from 'shared';

export interface StreamCallbacks {
  onText: (text: string) => void;
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
  } else {
    return gemini.streamCompletion(systemPrompt, userMessage, callbacks);
  }
}

export async function getCompletion(systemPrompt: string, userMessage: string): Promise<string> {
  const provider = await getCurrentProvider();
  console.log('[AI] getCompletion using provider:', provider);

  if (provider === 'claude') {
    return claude.getCompletion(systemPrompt, userMessage);
  } else {
    return gemini.getCompletion(systemPrompt, userMessage);
  }
}

export function resetClients(): void {
  claude.resetClient();
  gemini.resetClient();
}

// System prompts for different operations
export const SYSTEM_PROMPTS = {
  // For single words - include examples
  word: `You are a Bangla language tutor. Define the word directly and concisely.

Format:
**[word]** ([transliteration]) - [English meaning]

*[part of speech]*

**Examples:**
1. [Bangla sentence] — [English translation]
2. [Bangla sentence] — [English translation]

**Notes:** [Brief usage notes, grammar, or cultural context if relevant]

Be direct. No preamble like "Let's break down..." or "Absolutely!". Start with the word itself.`,

  // For sentences or phrases - no need for extra examples
  sentence: `You are a Bangla language tutor. Analyze the sentence directly.

Format:
**Translation:** [English translation]

**Breakdown:**
- **[word1]** ([transliteration]) — [meaning]
- **[word2]** ([transliteration]) — [meaning]
[continue for key words]

**Grammar:** [Brief explanation of sentence structure if notable]

Be direct. No preamble. Start with the translation.`,

  // For sentences with specific highlighted words to focus on
  focusedWords: `You are a Bangla language tutor. The user has pasted a sentence and highlighted specific words they want to learn.

Format your response as:

**Sentence Translation:** [English translation]

Then for EACH highlighted word:

---
**[word]** ([transliteration]) — [meaning]

*[part of speech]*

In this sentence: [explanation of how the word is used in this specific context]

**Example:** [one additional example sentence] — [translation]

---

Be direct. No preamble. Focus on the highlighted words in the context of the given sentence.`,

  // Legacy chat prompt (kept for compatibility)
  chat: `You are a Bangla language tutor. Help the user understand Bangla words and sentences.

For single words: Give meaning, pronunciation, part of speech, 2-3 example sentences, and usage notes.
For sentences: Translate, break down vocabulary, explain grammar.

Be direct and concise. No preamble like "Let's break down..." or "Absolutely!". Use markdown formatting.`,

  extractCard: `Extract flashcard data from the conversation. Return ONLY valid JSON with this exact structure:
{
  "word": "the Bangla word",
  "definition": "concise English definition",
  "exampleSentence": "one good example sentence in Bangla",
  "sentenceTranslation": "English translation of the example"
}

Pick the best single example sentence. Keep the definition concise (under 10 words if possible).`,

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
