import { describe, it, expect } from 'vitest';
import { getSystemPrompts, renderUserTemplate, getRelemmatizePrompt } from './ai.js';

describe('getSystemPrompts', () => {
  it('returns all prompt types', () => {
    const prompts = getSystemPrompts(false);
    expect(prompts).toHaveProperty('word');
    expect(prompts).toHaveProperty('sentence');
    expect(prompts).toHaveProperty('focusedWords');
    expect(prompts).toHaveProperty('extractCard');
  });

  it('does not return removed prompt types', () => {
    const prompts = getSystemPrompts(false);
    expect(prompts).not.toHaveProperty('define');
    expect(prompts).not.toHaveProperty('analyze');
  });

  it('all prompts are non-empty strings', () => {
    const prompts = getSystemPrompts(false);
    for (const [key, value] of Object.entries(prompts)) {
      expect(value, `prompt "${key}" should be a non-empty string`).toBeTruthy();
      expect(typeof value).toBe('string');
    }
  });

  it('includes transliteration instruction when enabled', () => {
    const withTranslit = getSystemPrompts(true);
    const withoutTranslit = getSystemPrompts(false);

    // With transliteration should include the instruction
    expect(withTranslit.word).toContain('transliteration');
    // Without transliteration should include the "Do NOT" instruction
    expect(withoutTranslit.word).toContain('Do NOT');
  });

  it('does not contain unresolved template variables', () => {
    const prompts = getSystemPrompts(true);
    for (const [key, value] of Object.entries(prompts)) {
      expect(value, `prompt "${key}" has unresolved {{variables}}`).not.toMatch(/\{\{.*?\}\}/);
    }

    const promptsNoTranslit = getSystemPrompts(false);
    for (const [key, value] of Object.entries(promptsNoTranslit)) {
      expect(value, `prompt "${key}" has unresolved {{variables}}`).not.toMatch(/\{\{.*?\}\}/);
    }
  });

  it('includes lemma rules in prompts', () => {
    const prompts = getSystemPrompts(false);
    // The word prompt should include Bangla lemmatization rules
    expect(prompts.word).toContain('Lemmatization');
  });
});

describe('renderUserTemplate', () => {
  it('returns rendered string for word prompt with word only', () => {
    const result = renderUserTemplate('word', { word: 'করা' });
    expect(result).toBe('করা');
  });

  it('includes user context formatted as "(User note: ...)" when provided', () => {
    const result = renderUserTemplate('word', {
      word: 'করা',
      userContext: 'past tense usage',
    });
    expect(result).toContain('করা');
    expect(result).toContain('(User note: past tense usage)');
  });

  it('returns null when template does not exist for given key', () => {
    const result = renderUserTemplate('extractCard', { word: 'test' });
    expect(result).toBeNull();
  });

  it('handles missing optional variables gracefully', () => {
    const result = renderUserTemplate('word', {});
    expect(result).not.toBeNull();
    // Should not throw and should return a string (empty word replaced with '')
    expect(typeof result).toBe('string');
  });

  it('has no unresolved {{variables}} in rendered output', () => {
    const wordResult = renderUserTemplate('word', {
      word: 'করা',
      userContext: 'some context',
    });
    expect(wordResult).not.toMatch(/\{\{.*?\}\}/);

    const sentenceResult = renderUserTemplate('sentence', {
      sentence: 'ছেলেটা বাজারে যাচ্ছে',
      userContext: 'colloquial speech',
    });
    expect(sentenceResult).not.toMatch(/\{\{.*?\}\}/);

    const focusedResult = renderUserTemplate('focusedWords', {
      sentence: 'ছেলেটা বাজারে যাচ্ছে',
      highlightedWords: 'বাজারে, যাচ্ছে',
    });
    expect(focusedResult).not.toMatch(/\{\{.*?\}\}/);
  });

  it('renders sentence template with sentence variable', () => {
    const result = renderUserTemplate('sentence', {
      sentence: 'ছেলেটা বাজারে যাচ্ছে',
    });
    expect(result).toContain('ছেলেটা বাজারে যাচ্ছে');
  });

  it('renders focused-words template with sentence and highlighted words', () => {
    const result = renderUserTemplate('focusedWords', {
      sentence: 'ছেলেটা বাজারে যাচ্ছে',
      highlightedWords: 'বাজারে, যাচ্ছে',
    });
    expect(result).toContain('ছেলেটা বাজারে যাচ্ছে');
    expect(result).toContain('বাজারে, যাচ্ছে');
  });
});

describe('getRelemmatizePrompt', () => {
  it('substitutes word into template', () => {
    const prompt = getRelemmatizePrompt('করেছিল');
    expect(prompt).toContain('করেছিল');
  });

  it('includes context sentence when provided', () => {
    const prompt = getRelemmatizePrompt('করেছিল', 'সে কাজটা করেছিল');
    expect(prompt).toContain('করেছিল');
    expect(prompt).toContain('সে কাজটা করেছিল');
  });

  it('does not include context line when no sentence provided', () => {
    const prompt = getRelemmatizePrompt('করেছিল');
    expect(prompt).not.toContain('Context sentence');
  });

  it('does not contain unresolved template variables', () => {
    const prompt = getRelemmatizePrompt('test', 'some context');
    expect(prompt).not.toMatch(/\{\{.*?\}\}/);
  });
});
