import { GoogleGenAI } from '@google/genai';
import { getSettings } from './settings.js';
import type { TokenUsage } from 'shared';

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

export async function getJsonCompletion(
  systemPrompt: string,
  userMessage: string
): Promise<{ text: string; usage?: TokenUsage }> {
  try {
    const genai = await getClient();
    const settings = await getSettings();
    const model = settings.geminiModel || 'gemini-2.5-flash-lite';

    const response = await genai.models.generateContent({
      model,
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        maxOutputTokens: 2048,
      },
    });

    const usage: TokenUsage | undefined = response.usageMetadata
      ? {
          inputTokens: response.usageMetadata.promptTokenCount ?? 0,
          outputTokens: response.usageMetadata.candidatesTokenCount ?? 0,
          provider: 'gemini',
          model,
        }
      : undefined;

    return { text: response.text ?? '', usage };
  } catch (error) {
    console.error('[Gemini] JSON completion error:', error);
    throw error;
  }
}
