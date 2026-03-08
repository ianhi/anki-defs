import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
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

// Load shared prompt JSON files
const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = resolve(__dirname, '../../../shared/prompts');

function loadPrompt(name: string): { system: string; user_template?: string } {
  const filePath = resolve(promptsDir, `${name}.json`);
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

interface Variables {
  preamble: string;
  sharedRules: string;
  lemmaRules: string;
  transliteration: {
    instruction: { true: string; false: string };
    marker: { true: string; false: string };
  };
}

const variables: Variables = JSON.parse(
  readFileSync(resolve(promptsDir, 'variables.json'), 'utf-8')
);

const promptTemplates = {
  word: loadPrompt('single-word'),
  sentence: loadPrompt('sentence'),
  focusedWords: loadPrompt('focused-words'),
  extractCard: loadPrompt('card-extraction'),
  relemmatize: loadPrompt('relemmatize'),
};

function renderPrompt(template: string, transliteration: boolean): string {
  const key = transliteration ? 'true' : 'false';
  return template
    .replace(/\{\{preamble\}\}/g, variables.preamble)
    .replace(/\{\{sharedRules\}\}/g, variables.sharedRules)
    .replace(/\{\{transliterationInstruction\}\}/g, variables.transliteration.instruction[key])
    .replace(/\{\{translitMarker\}\}/g, variables.transliteration.marker[key])
    .replace(/\{\{lemmaRules\}\}/g, variables.lemmaRules);
}

// System prompts for different operations
// transliteration param controls whether romanized pronunciation is included
export function getSystemPrompts(transliteration: boolean) {
  return {
    word: renderPrompt(promptTemplates.word.system, transliteration),
    sentence: renderPrompt(promptTemplates.sentence.system, transliteration),
    focusedWords: renderPrompt(promptTemplates.focusedWords.system, transliteration),
    extractCard: renderPrompt(promptTemplates.extractCard.system, transliteration),
  };
}

// Render a user_template from a prompt file with variable substitution
export function renderUserTemplate(
  templateKey: keyof typeof promptTemplates,
  variables: {
    word?: string;
    userContext?: string;
    sentence?: string;
    highlightedWords?: string;
  }
): string | null {
  const template = promptTemplates[templateKey];
  if (!template.user_template) return null;

  let result = template.user_template;
  result = result.replace(/\{\{word\}\}/g, variables.word || '');
  result = result.replace(
    /\{\{userContext\}\}/g,
    variables.userContext ? `\n\n(User note: ${variables.userContext})` : ''
  );
  result = result.replace(/\{\{sentence\}\}/g, variables.sentence || '');
  result = result.replace(/\{\{highlightedWords\}\}/g, variables.highlightedWords || '');
  return result;
}

// Relemmatize prompt is special -- it has word/context placeholders, not transliteration
export function getRelemmatizePrompt(word: string, sentence?: string): string {
  const context = sentence ? `\nContext sentence: ${sentence}` : '';
  return promptTemplates.relemmatize.system
    .replace(/\{\{word\}\}/g, word)
    .replace(/\{\{context\}\}/g, context);
}
