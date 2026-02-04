import Anthropic from '@anthropic-ai/sdk';
import { getSettings } from './settings.js';

let client: Anthropic | null = null;

async function getClient(): Promise<Anthropic> {
  const settings = await getSettings();
  if (!settings.claudeApiKey) {
    throw new Error('Claude API key not configured');
  }
  if (!client) {
    client = new Anthropic({ apiKey: settings.claudeApiKey });
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
  const anthropic = await getClient();

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
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

  await stream.finalMessage();
}

export async function getCompletion(systemPrompt: string, userMessage: string): Promise<string> {
  const anthropic = await getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock ? textBlock.text : '';
}
