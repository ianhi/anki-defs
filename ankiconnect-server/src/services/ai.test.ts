import { describe, it, expect } from 'vitest';
import { getSystemPrompts, getRelemmatizePrompt } from './ai.js';

describe('getSystemPrompts', () => {
  it('returns all prompt types', () => {
    const prompts = getSystemPrompts(false);
    expect(prompts).toHaveProperty('word');
    expect(prompts).toHaveProperty('sentence');
    expect(prompts).toHaveProperty('focusedWords');
    expect(prompts).toHaveProperty('extractCard');
    expect(prompts).toHaveProperty('define');
    expect(prompts).toHaveProperty('analyze');
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
