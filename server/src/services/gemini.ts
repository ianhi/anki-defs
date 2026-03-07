import { GoogleGenAI, Type } from '@google/genai';
import { getSettings } from './settings.js';
import type { CardPreview, TokenUsage } from 'shared';

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
  onUsage: (usage: TokenUsage) => void;
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
    const settings = await getSettings();
    const model = settings.geminiModel || 'gemini-2.5-flash-lite';

    const response = await genai.models.generateContentStream({
      model,
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 2048,
      },
    });

    let usageMeta: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
    for await (const chunk of response) {
      if (chunk.usageMetadata) {
        usageMeta = chunk.usageMetadata;
      }
      const text = chunk.text;
      if (text) {
        callbacks.onText(text);
      }
    }

    if (usageMeta) {
      callbacks.onUsage({
        inputTokens: usageMeta.promptTokenCount ?? 0,
        outputTokens: usageMeta.candidatesTokenCount ?? 0,
        provider: 'gemini',
        model,
      });
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
    const settings = await getSettings();

    const response = await genai.models.generateContent({
      model: settings.geminiModel || 'gemini-2.5-flash-lite',
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
  const settings = await getSettings();

  const response = await genai.models.generateContent({
    model: settings.geminiModel || 'gemini-2.5-flash-lite',
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

  let data: Record<string, string>;
  try {
    data = JSON.parse(response.text ?? '{}');
  } catch {
    console.error('[Gemini] Failed to parse card extraction response:', response.text);
    data = {};
  }
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
  const settings = await getSettings();

  const response = await genai.models.generateContent({
    model: settings.geminiModel || 'gemini-2.5-flash-lite',
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

  let data: Record<string, string>;
  try {
    data = JSON.parse(response.text ?? '{}');
  } catch {
    console.error('[Gemini] Failed to parse sentence card extraction response:', response.text);
    data = {};
  }
  console.log('[Gemini] Card data extracted:', data);

  return {
    word: data.word || word,
    definition: data.definition || '',
    exampleSentence: originalSentence,
    sentenceTranslation: sentenceTranslation,
  };
}
