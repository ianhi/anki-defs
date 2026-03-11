import OpenAI from 'openai';
import { getSettings } from './settings.js';
import type { TokenUsage } from 'shared';

let client: OpenAI | null = null;

async function getClient(): Promise<OpenAI> {
  const settings = await getSettings();
  if (!settings.openRouterApiKey) {
    throw new Error('OpenRouter API key not configured');
  }
  if (!client) {
    console.log(
      '[OpenRouter] Creating client (key ends ...%s)',
      settings.openRouterApiKey.slice(-4)
    );
    client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: settings.openRouterApiKey,
    });
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
    const settings = await getSettings();
    const openai = await getClient();

    const stream = await openai.chat.completions.create({
      model: settings.openRouterModel || 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2048,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        callbacks.onText(text);
      }
      if (chunk.usage) {
        callbacks.onUsage({
          inputTokens: chunk.usage.prompt_tokens ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
          provider: 'openrouter',
          model: settings.openRouterModel || 'google/gemini-2.5-flash',
        });
      }
    }

    callbacks.onDone();
  } catch (error) {
    console.error('[OpenRouter] Stream error:', error);
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getCompletion(systemPrompt: string, userMessage: string): Promise<string> {
  try {
    const settings = await getSettings();
    const openai = await getClient();

    const response = await openai.chat.completions.create({
      model: settings.openRouterModel || 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2048,
    });

    return response.choices[0]?.message?.content ?? '';
  } catch (error) {
    console.error('[OpenRouter] Completion error:', error);
    throw error;
  }
}

export async function getJsonCompletion(
  systemPrompt: string,
  userMessage: string
): Promise<{ text: string; usage?: TokenUsage }> {
  try {
    const settings = await getSettings();
    const openai = await getClient();

    const response = await openai.chat.completions.create({
      model: settings.openRouterModel || 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2048,
    });

    const usage: TokenUsage | undefined = response.usage
      ? {
          inputTokens: response.usage.prompt_tokens ?? 0,
          outputTokens: response.usage.completion_tokens ?? 0,
          provider: 'openrouter',
          model: settings.openRouterModel || 'google/gemini-2.5-flash',
        }
      : undefined;

    return { text: response.choices[0]?.message?.content ?? '', usage };
  } catch (error) {
    console.error('[OpenRouter] JSON completion error:', error);
    throw error;
  }
}
