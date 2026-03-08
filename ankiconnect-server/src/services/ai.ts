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

export async function getJsonCompletion(
  systemPrompt: string,
  userMessage: string
): Promise<{ text: string; usage?: TokenUsage }> {
  const provider = await getCurrentProvider();
  console.log('[AI] getJsonCompletion using provider:', provider);

  if (provider === 'claude') {
    return claude.getJsonCompletion(systemPrompt, userMessage);
  } else if (provider === 'openrouter') {
    return openrouter.getJsonCompletion(systemPrompt, userMessage);
  } else {
    return gemini.getJsonCompletion(systemPrompt, userMessage);
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

function loadPrompt(name: string): {
  system: string;
  system_focused?: string;
  user_template?: string;
  user_template_focused?: string;
} {
  const filePath = resolve(promptsDir, `${name}.json`);
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

interface Variables {
  preamble: string;
  outputRules: string;
  languageRules: string;
  transliteration: {
    instruction: { true: string; false: string };
    marker: { true: string; false: string };
  };
}

function loadVariables(): Variables {
  return JSON.parse(readFileSync(resolve(promptsDir, 'variables.json'), 'utf-8'));
}

function loadAllPrompts() {
  return {
    word: loadPrompt('single-word'),
    focusedWords: loadPrompt('focused-words'),
    relemmatize: loadPrompt('relemmatize'),
    englishToBangla: loadPrompt('english-to-bangla'),
  };
}

// Cached at startup; reloadPrompts() refreshes from disk
let variables: Variables = loadVariables();
let promptTemplates = loadAllPrompts();

export function reloadPrompts(): void {
  variables = loadVariables();
  promptTemplates = loadAllPrompts();
}

function renderPrompt(template: string, transliteration: boolean): string {
  const key = transliteration ? 'true' : 'false';
  return template
    .replace(/\{\{preamble\}\}/g, variables.preamble)
    .replace(/\{\{outputRules\}\}/g, variables.outputRules)
    .replace(/\{\{languageRules\}\}/g, variables.languageRules)
    .replace(/\{\{transliterationInstruction\}\}/g, variables.transliteration.instruction[key])
    .replace(/\{\{translitMarker\}\}/g, variables.transliteration.marker[key]);
}

// System prompts for different operations
// transliteration param controls whether romanized pronunciation is included
export function getSystemPrompts(transliteration: boolean) {
  return {
    word: renderPrompt(promptTemplates.word.system, transliteration),
    focusedWords: renderPrompt(promptTemplates.focusedWords.system, transliteration),
    englishToBangla: renderPrompt(promptTemplates.englishToBangla.system, transliteration),
    englishToBanglaFocused: renderPrompt(
      promptTemplates.englishToBangla.system_focused || promptTemplates.englishToBangla.system,
      transliteration
    ),
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
  },
  variant?: 'focused'
): string | null {
  const template = promptTemplates[templateKey];
  const templateStr =
    variant === 'focused' && template.user_template_focused
      ? template.user_template_focused
      : template.user_template;
  if (!templateStr) return null;

  let result = templateStr;
  result = result.replace(/\{\{word\}\}/g, variables.word || '');
  result = result.replace(
    /\{\{userContext\}\}/g,
    variables.userContext ? `\n\n(User note: ${variables.userContext})` : ''
  );
  result = result.replace(/\{\{sentence\}\}/g, variables.sentence || '');
  result = result.replace(/\{\{highlightedWords\}\}/g, variables.highlightedWords || '');
  return result;
}

export type SystemPrompts = ReturnType<typeof getSystemPrompts>;

export interface PromptSelection {
  mode: string;
  systemPrompt: string;
  userMessage: string;
}

/**
 * Classify input and select the appropriate prompt + user message.
 * Shared by chat.ts and prompts.ts to avoid duplicating selection logic.
 */
export function selectPrompt(
  prompts: SystemPrompts,
  newMessage: string,
  opts: {
    highlightedWords?: string[];
    userContext?: string;
    mode?: string;
  }
): PromptSelection {
  const trimmed = newMessage.trim();
  const isEnglishToBangla = opts.mode === 'english-to-bangla';
  const isSingleWord = !trimmed.includes(' ') && trimmed.length < 30;
  const hasHighlights = opts.highlightedWords && opts.highlightedWords.length > 0;

  if (isEnglishToBangla && hasHighlights) {
    const rendered = renderUserTemplate(
      'englishToBangla',
      { sentence: newMessage, highlightedWords: opts.highlightedWords!.join(', ') },
      'focused'
    );
    return {
      mode: 'english-to-bangla-focused',
      systemPrompt: prompts.englishToBanglaFocused,
      userMessage:
        rendered || `Sentence: ${newMessage}\n\nFocus words: ${opts.highlightedWords!.join(', ')}`,
    };
  }

  if (isEnglishToBangla) {
    const rendered = renderUserTemplate('englishToBangla', {
      word: newMessage,
      userContext: opts.userContext,
    });
    return {
      mode: 'english-to-bangla',
      systemPrompt: prompts.englishToBangla,
      userMessage: rendered || newMessage,
    };
  }

  if (hasHighlights) {
    const rendered = renderUserTemplate('focusedWords', {
      sentence: newMessage,
      highlightedWords: opts.highlightedWords!.join(', '),
    });
    return {
      mode: 'focused-words',
      systemPrompt: prompts.focusedWords,
      userMessage:
        rendered || `Sentence: ${newMessage}\n\nFocus words: ${opts.highlightedWords!.join(', ')}`,
    };
  }

  if (isSingleWord) {
    const rendered = renderUserTemplate('word', {
      word: newMessage,
      userContext: opts.userContext,
    });
    return {
      mode: 'single-word',
      systemPrompt: prompts.word,
      userMessage: rendered || newMessage,
    };
  }

  return {
    mode: 'sentence-blocked',
    systemPrompt: '',
    userMessage: newMessage,
  };
}

// Relemmatize prompt is special -- it has word/context placeholders, not transliteration
export function getRelemmatizePrompt(word: string, sentence?: string): string {
  const context = sentence ? `\nContext sentence: ${sentence}` : '';
  return promptTemplates.relemmatize.system
    .replace(/\{\{word\}\}/g, word)
    .replace(/\{\{context\}\}/g, context);
}
