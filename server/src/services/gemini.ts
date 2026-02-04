import { GoogleGenAI, Type } from '@google/genai';
import { getSettings } from './settings.js';
import type { CardPreview } from 'shared';

let client: GoogleGenAI | null = null;

async function getClient(): Promise<GoogleGenAI> {
  const settings = await getSettings();

  if (!settings.geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  if (!client) {
    console.log('[Gemini] Creating client (key ends ...%s)', settings.geminiApiKey.slice(-4));
    client = new GoogleGenAI({ apiKey: settings.geminiApiKey });
  }
  return client;
}

export function resetClient(): void {
  client = null;
}

export interface StreamCallbacks {
  onText: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamCompletion(
  systemPrompt: string,
  userMessage: string,
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    const genai = await getClient();

    const response = await genai.models.generateContentStream({
      model: 'gemini-2.0-flash',
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 2048,
      },
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        callbacks.onText(text);
      }
    }

    callbacks.onDone();
  } catch (error) {
    console.error('[Gemini] Stream error:', error);
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getCompletion(systemPrompt: string, userMessage: string): Promise<string> {
  try {
    const genai = await getClient();

    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 2048,
      },
    });

    return response.text ?? '';
  } catch (error) {
    console.error('[Gemini] Completion error:', error);
    throw error;
  }
}

// Structured output for card extraction - single word mode (extract from AI examples)
export async function extractCardData(
  word: string,
  explanation: string
): Promise<Omit<CardPreview, 'alreadyExists' | 'noteId'>> {
  console.log('[Gemini] Extracting card data for single word:', word);

  const genai = await getClient();

  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Extract flashcard data from this explanation of the Bangla word "${word}":\n\n${explanation}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: {
            type: Type.STRING,
            description: 'The Bangla word (lemmatized/dictionary form)',
          },
          definition: {
            type: Type.STRING,
            description: 'Concise English definition (2-5 words, ideal for flashcard)',
          },
          exampleSentence: {
            type: Type.STRING,
            description: 'One natural example sentence in Bangla from the explanation',
          },
          sentenceTranslation: {
            type: Type.STRING,
            description: 'English translation of the example sentence',
          },
        },
        required: ['word', 'definition', 'exampleSentence', 'sentenceTranslation'],
      },
    },
  });

  const data = JSON.parse(response.text ?? '{}');
  console.log('[Gemini] Card data extracted:', data);

  return {
    word: data.word || word,
    definition: data.definition || '',
    exampleSentence: data.exampleSentence || '',
    sentenceTranslation: data.sentenceTranslation || '',
  };
}

// Structured output for card extraction - sentence mode (use original sentence as example)
export async function extractCardDataFromSentence(
  word: string,
  originalSentence: string,
  sentenceTranslation: string,
  explanation: string
): Promise<Omit<CardPreview, 'alreadyExists' | 'noteId'>> {
  console.log('[Gemini] Extracting card data for word in sentence:', word);

  const genai = await getClient();

  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Extract the definition for the Bangla word "${word}" from this explanation:\n\n${explanation}\n\nThe example sentence is already provided: "${originalSentence}"`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: {
            type: Type.STRING,
            description: 'The Bangla word (lemmatized/dictionary form)',
          },
          definition: {
            type: Type.STRING,
            description: 'Concise English definition (2-5 words, ideal for flashcard)',
          },
        },
        required: ['word', 'definition'],
      },
    },
  });

  const data = JSON.parse(response.text ?? '{}');
  console.log('[Gemini] Card data extracted:', data);

  return {
    word: data.word || word,
    definition: data.definition || '',
    exampleSentence: originalSentence,
    sentenceTranslation: sentenceTranslation,
  };
}

// Structured output for word definition
export interface WordDefinition {
  word: string;
  lemma: string;
  pronunciation: string;
  partOfSpeech: string;
  shortMeaning: string;
  meaning: string;
  nuance: string;
  exampleSentence: string;
  exampleTranslation: string;
}

export async function getWordDefinition(word: string): Promise<WordDefinition> {
  console.log('[Gemini] Getting structured definition for:', word);

  const genai = await getClient();

  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Define this Bangla word: "${word}"`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: 'The word as provided' },
          lemma: { type: Type.STRING, description: 'Dictionary/lemmatized form' },
          pronunciation: { type: Type.STRING, description: 'Romanized pronunciation' },
          partOfSpeech: { type: Type.STRING, description: 'Part of speech (noun, verb, etc.)' },
          shortMeaning: { type: Type.STRING, description: '2-4 word definition for flashcards' },
          meaning: { type: Type.STRING, description: 'Full definition' },
          nuance: {
            type: Type.STRING,
            description: 'Usage notes, cultural context, or grammar tips',
          },
          exampleSentence: { type: Type.STRING, description: 'Example sentence in Bangla' },
          exampleTranslation: { type: Type.STRING, description: 'English translation of example' },
        },
        required: [
          'word',
          'lemma',
          'pronunciation',
          'partOfSpeech',
          'shortMeaning',
          'meaning',
          'nuance',
          'exampleSentence',
          'exampleTranslation',
        ],
      },
    },
  });

  return JSON.parse(response.text ?? '{}');
}
