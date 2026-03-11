import Anthropic from '@anthropic-ai/sdk';
import { getSettings } from './settings.js';
import type { TokenUsage } from 'shared';

let client: Anthropic | null = null;

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

async function getClient(): Promise<Anthropic> {
  const settings = await getSettings();
  if (!settings.claudeApiKey) {
    throw new Error('Claude API key not configured');
  }
  if (!client) {
    console.log('[Claude] Creating client (key: ...%s)', settings.claudeApiKey.slice(-4));
    client = new Anthropic({ apiKey: settings.claudeApiKey });
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
    const anthropic = await getClient();

    const stream = anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    stream.on('text', (text) => {
      callbacks.onText(text);
    });

    stream.on('error', (error) => {
      callbacks.onError(error);
    });

    stream.on('end', () => {
      callbacks.onDone();
    });

    const finalMessage = await stream.finalMessage();
    if (finalMessage.usage) {
      callbacks.onUsage({
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        provider: 'claude',
        model: finalMessage.model,
      });
    }
  } catch (error) {
    console.error('[Claude] streamCompletion error:', error);
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getCompletion(systemPrompt: string, userMessage: string): Promise<string> {
  try {
    const anthropic = await getClient();

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock ? textBlock.text : '';
  } catch (error) {
    console.error('[Claude] getCompletion error:', error);
    throw error;
  }
}

export async function getJsonCompletion(
  systemPrompt: string,
  userMessage: string
): Promise<{ text: string; usage?: TokenUsage }> {
  try {
    const anthropic = await getClient();

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const usage: TokenUsage | undefined = response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          provider: 'claude',
          model: response.model,
        }
      : undefined;

    return { text: textBlock ? textBlock.text : '', usage };
  } catch (error) {
    console.error('[Claude] getJsonCompletion error:', error);
    throw error;
  }
}
