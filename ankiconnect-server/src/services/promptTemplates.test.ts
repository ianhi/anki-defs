import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = resolve(__dirname, '../../../shared/prompts');

function loadPrompt(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(promptsDir, `${name}.json`), 'utf-8'));
}

const singleWord = loadPrompt('single-word');
const sentence = loadPrompt('sentence');
const focusedWords = loadPrompt('focused-words');
const cardExtraction = loadPrompt('card-extraction');
const variables = loadPrompt('variables');

describe('prompt template JSON files', () => {
  const promptFiles = [
    'single-word',
    'sentence',
    'focused-words',
    'card-extraction',
    'relemmatize',
  ];

  it.each(promptFiles)('%s has a non-empty system field', (name) => {
    const prompt = loadPrompt(name);
    expect(prompt.system).toBeDefined();
    expect(typeof prompt.system).toBe('string');
    expect((prompt.system as string).length).toBeGreaterThan(0);
  });
});

describe('single-word.json', () => {
  it('has user_template with {{word}} and {{userContext}}', () => {
    expect(singleWord.user_template).toBeDefined();
    expect(singleWord.user_template).toContain('{{word}}');
    expect(singleWord.user_template).toContain('{{userContext}}');
  });

  it('mentions colloquial or dialectal handling', () => {
    const system = singleWord.system as string;
    expect(system).toMatch(/colloquial|dialectal/i);
  });
});

describe('sentence.json', () => {
  it('has user_template with {{sentence}} and {{userContext}}', () => {
    expect(sentence.user_template).toBeDefined();
    expect(sentence.user_template).toContain('{{sentence}}');
    expect(sentence.user_template).toContain('{{userContext}}');
  });

  it('contains "Do NOT generate example sentences"', () => {
    expect(sentence.system as string).toContain('Do NOT generate example sentences');
  });
});

describe('focused-words.json', () => {
  it('has user_template with {{sentence}} and {{highlightedWords}}', () => {
    expect(focusedWords.user_template).toBeDefined();
    expect(focusedWords.user_template).toContain('{{sentence}}');
    expect(focusedWords.user_template).toContain('{{highlightedWords}}');
  });

  it('contains "Do NOT generate example sentences"', () => {
    expect(focusedWords.system as string).toContain('Do NOT generate example sentences');
  });
});

describe('card-extraction.json', () => {
  it('does NOT have a user_template', () => {
    expect(cardExtraction.user_template).toBeUndefined();
  });
});

describe('variables.json', () => {
  it('has lemmaRules as a non-empty string', () => {
    expect(variables.lemmaRules).toBeDefined();
    expect(typeof variables.lemmaRules).toBe('string');
    expect((variables.lemmaRules as string).length).toBeGreaterThan(0);
  });

  it('has transliteration.instruction with true and false keys', () => {
    const translit = variables.transliteration as Record<string, Record<string, string>>;
    expect(translit).toBeDefined();
    const instruction = translit.instruction;
    expect(instruction).toBeDefined();
    expect(typeof instruction!.true).toBe('string');
    expect(typeof instruction!.false).toBe('string');
  });

  it('has transliteration.marker with true and false keys', () => {
    const translit = variables.transliteration as Record<string, Record<string, string>>;
    const marker = translit.marker;
    expect(marker).toBeDefined();
    expect(typeof marker!.true).toBe('string');
    expect(typeof marker!.false).toBe('string');
  });
});
