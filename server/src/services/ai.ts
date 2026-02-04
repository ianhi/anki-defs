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
  return settings.aiProvider;
}

export async function streamCompletion(
  systemPrompt: string,
  userMessage: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const provider = await getCurrentProvider();

  if (provider === 'claude') {
    return claude.streamCompletion(systemPrompt, userMessage, callbacks);
  } else {
    return gemini.streamCompletion(systemPrompt, userMessage, callbacks);
  }
}

export async function getCompletion(systemPrompt: string, userMessage: string): Promise<string> {
  const provider = await getCurrentProvider();

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
  define: `You are a Bangla language expert helping someone learn vocabulary. When given a Bangla word:

1. Provide the English definition
2. Identify the part of speech
3. Give 2-3 example sentences in Bangla with English translations
4. Note any common collocations or usage patterns

Format your response as JSON:
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

  analyze: `You are a Bangla language expert. Analyze the given Bangla sentence:

1. Provide an English translation
2. Break down each word with its lemma (dictionary form), part of speech, and meaning
3. Note any grammatical patterns or constructions

Format your response as JSON:
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

  chat: `You are a helpful Bangla language learning assistant. Help the user learn Bangla vocabulary and grammar.

When the user asks about a word:
- Provide clear definitions
- Give example sentences
- Explain any relevant grammar

When the user pastes a sentence:
- Translate it
- Break down the vocabulary
- Explain the grammar

Be encouraging and helpful. If the user makes mistakes, gently correct them.

If you identify a word that should be added to the user's flashcard deck, suggest creating a card with:
- The Bangla word
- English definition
- An example sentence
- The sentence translation

Format card suggestions as:
[CARD]
Word: বাংলা শব্দ
Definition: English meaning
Example: বাংলা বাক্য
Translation: English sentence
[/CARD]`,
};
