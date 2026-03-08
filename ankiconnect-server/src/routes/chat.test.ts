import { describe, it, expect } from 'vitest';
import { parseJsonResponse } from './chat.js';

describe('parseJsonResponse', () => {
  it('parses valid JSON', () => {
    const result = parseJsonResponse('{"word": "বাজার", "definition": "market"}');
    expect(result).toEqual({ word: 'বাজার', definition: 'market' });
  });

  it('strips code-fenced JSON and parses', () => {
    const raw = '```json\n{"word": "বাজার", "definition": "market"}\n```';
    const result = parseJsonResponse(raw);
    expect(result).toEqual({ word: 'বাজার', definition: 'market' });
  });

  it('strips code fences without language tag', () => {
    const raw = '```\n{"word": "বাজার"}\n```';
    const result = parseJsonResponse(raw);
    expect(result).toEqual({ word: 'বাজার' });
  });

  it('parses JSON arrays', () => {
    const raw = '[{"word": "a"}, {"word": "b"}]';
    const result = parseJsonResponse(raw);
    expect(result).toEqual([{ word: 'a' }, { word: 'b' }]);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseJsonResponse('not json at all')).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => parseJsonResponse('')).toThrow();
  });
});
