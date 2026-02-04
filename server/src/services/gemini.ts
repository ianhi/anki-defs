import { GoogleGenAI } from '@google/genai';
import { getSettings } from './settings.js';

let client: GoogleGenAI | null = null;

async function getClient(): Promise<GoogleGenAI> {
  const settings = await getSettings();
  if (!settings.geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }
  if (!client) {
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
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getCompletion(systemPrompt: string, userMessage: string): Promise<string> {
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
}
