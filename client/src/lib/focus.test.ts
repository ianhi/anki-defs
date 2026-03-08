import { describe, it, expect } from 'vitest';
import {
  parseHighlightedWords,
  getCleanText,
  parseWordTokens,
  toggleTokenInText,
  getTokenAtCursor,
} from './focus';

describe('parseHighlightedWords', () => {
  it('returns empty array for no highlights', () => {
    expect(parseHighlightedWords('hello world')).toEqual([]);
  });

  it('extracts single highlighted word', () => {
    expect(parseHighlightedWords('hello **world** today')).toEqual(['world']);
  });

  it('extracts multiple highlighted words', () => {
    expect(parseHighlightedWords('**hello** some **world**')).toEqual(['hello', 'world']);
  });

  it('handles Bangla text', () => {
    expect(parseHighlightedWords('সে **বাজারে** যাচ্ছে')).toEqual(['বাজারে']);
  });

  it('ignores incomplete markers', () => {
    expect(parseHighlightedWords('**hello world')).toEqual([]);
    expect(parseHighlightedWords('hello** world')).toEqual([]);
  });
});

describe('getCleanText', () => {
  it('strips all ** markers', () => {
    expect(getCleanText('**hello** world **foo**')).toBe('hello world foo');
  });

  it('returns same text when no markers', () => {
    expect(getCleanText('hello world')).toBe('hello world');
  });
});

describe('parseWordTokens', () => {
  it('parses plain words', () => {
    const tokens = parseWordTokens('hello world');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ word: 'hello', highlighted: false, start: 0, end: 5 });
    expect(tokens[1]).toMatchObject({ word: 'world', highlighted: false, start: 6, end: 11 });
  });

  it('parses highlighted words', () => {
    const tokens = parseWordTokens('hello **world** today');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toMatchObject({ word: 'hello', highlighted: false });
    expect(tokens[1]).toMatchObject({ word: 'world', highlighted: true, start: 6, end: 15 });
    expect(tokens[2]).toMatchObject({ word: 'today', highlighted: false });
  });

  it('handles mixed highlighted and plain', () => {
    const tokens = parseWordTokens('**a** b **c**');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toMatchObject({ word: 'a', highlighted: true });
    expect(tokens[1]).toMatchObject({ word: 'b', highlighted: false });
    expect(tokens[2]).toMatchObject({ word: 'c', highlighted: true });
  });

  it('strips stray * from partial markers', () => {
    const tokens = parseWordTokens('**hello world');
    // **hello is not a complete marker, so matched as a partial
    expect(tokens[0]!.word).toBe('hello');
    expect(tokens[0]!.highlighted).toBe(false);
  });

  it('handles duplicate words with one highlighted', () => {
    const tokens = parseWordTokens('word **unknown** some other words unknown');
    const unknowns = tokens.filter((t) => t.word === 'unknown');
    expect(unknowns).toHaveLength(2);
    expect(unknowns[0]!.highlighted).toBe(true);
    expect(unknowns[1]!.highlighted).toBe(false);
  });

  it('handles Bangla text', () => {
    const tokens = parseWordTokens('সে **বাজারে** যাচ্ছে');
    expect(tokens).toHaveLength(3);
    expect(tokens[1]).toMatchObject({ word: 'বাজারে', highlighted: true });
  });
});

describe('toggleTokenInText', () => {
  describe('focusing (adding **)', () => {
    it('wraps a plain word in **', () => {
      const tokens = parseWordTokens('hello world');
      const result = toggleTokenInText('hello world', tokens[0]!);
      expect(result).toBe('**hello** world');
    });

    it('adds trailing space when word is at end of text', () => {
      const tokens = parseWordTokens('hello');
      const result = toggleTokenInText('hello', tokens[0]!);
      expect(result).toBe('**hello** ');
    });

    it('adds trailing space when next char is not whitespace', () => {
      // Simulating a case where words are jammed together
      const token = { word: 'hello', raw: 'hello', highlighted: false, start: 0, end: 5 };
      const result = toggleTokenInText('helloworld', token);
      expect(result).toBe('**hello** world');
    });

    it('does not add extra space when space already follows', () => {
      const tokens = parseWordTokens('hello world');
      const result = toggleTokenInText('hello world', tokens[0]!);
      expect(result).toBe('**hello** world');
    });

    it('strips stray * when focusing a partially marked word', () => {
      const tokens = parseWordTokens('**hello world');
      const result = toggleTokenInText('**hello world', tokens[0]!);
      expect(result).toBe('**hello** world');
    });

    it('focuses second occurrence of a duplicate word', () => {
      const text = '**unknown** some unknown';
      const tokens = parseWordTokens(text);
      const secondUnknown = tokens.find((t) => t.word === 'unknown' && !t.highlighted)!;
      const result = toggleTokenInText(text, secondUnknown);
      expect(result).toBe('**unknown** some **unknown** ');
    });
  });

  describe('unfocusing (removing **)', () => {
    it('removes ** markers from a focused word', () => {
      const tokens = parseWordTokens('hello **world** today');
      const result = toggleTokenInText('hello **world** today', tokens[1]!);
      expect(result).toBe('hello world today');
    });

    it('removes ** from first occurrence, keeps second', () => {
      const text = '**unknown** some **unknown**';
      const tokens = parseWordTokens(text);
      const firstUnknown = tokens.find((t) => t.word === 'unknown' && t.highlighted)!;
      const result = toggleTokenInText(text, firstUnknown);
      expect(result).toBe('unknown some **unknown**');
    });

    it('removes ** from word at end of text', () => {
      const tokens = parseWordTokens('hello **world**');
      const result = toggleTokenInText('hello **world**', tokens[1]!);
      expect(result).toBe('hello world');
    });
  });

  describe('Bangla text', () => {
    it('focuses a Bangla word', () => {
      const text = 'সে বাজারে যাচ্ছে';
      const tokens = parseWordTokens(text);
      const result = toggleTokenInText(text, tokens[1]!);
      expect(result).toBe('সে **বাজারে** যাচ্ছে');
    });

    it('unfocuses a Bangla word', () => {
      const text = 'সে **বাজারে** যাচ্ছে';
      const tokens = parseWordTokens(text);
      const result = toggleTokenInText(text, tokens[1]!);
      expect(result).toBe('সে বাজারে যাচ্ছে');
    });
  });
});

describe('getTokenAtCursor', () => {
  it('returns token when cursor is inside a word', () => {
    const text = 'hello world';
    const tokens = parseWordTokens(text);
    const token = getTokenAtCursor(tokens, 2, text);
    expect(token).toMatchObject({ word: 'hello' });
  });

  it('returns token when cursor is at start of word', () => {
    const text = 'hello world';
    const tokens = parseWordTokens(text);
    const token = getTokenAtCursor(tokens, 0, text);
    expect(token).toMatchObject({ word: 'hello' });
  });

  it('returns token when cursor is at end of word', () => {
    const text = 'hello world';
    const tokens = parseWordTokens(text);
    const token = getTokenAtCursor(tokens, 5, text);
    expect(token).toMatchObject({ word: 'hello' });
  });

  it('falls back to preceding token when cursor is on space', () => {
    const text = 'hello world';
    const tokens = parseWordTokens(text);
    // Cursor on the space between hello and world (mobile auto-space)
    const token = getTokenAtCursor(tokens, 5, text);
    expect(token).toMatchObject({ word: 'hello' });
  });

  it('falls back to preceding token when cursor is at end of text after space', () => {
    const text = 'hello ';
    const tokens = parseWordTokens(text);
    const token = getTokenAtCursor(tokens, 6, text);
    expect(token).toMatchObject({ word: 'hello' });
  });

  it('returns null when cursor is at start with no tokens', () => {
    const token = getTokenAtCursor([], 0, '');
    expect(token).toBeNull();
  });

  it('returns highlighted token when cursor is inside **word**', () => {
    const text = 'hello **world** today';
    const tokens = parseWordTokens(text);
    const token = getTokenAtCursor(tokens, 10, text);
    expect(token).toMatchObject({ word: 'world', highlighted: true });
  });

  it('returns correct token with duplicate words', () => {
    const text = '**unknown** some unknown';
    const tokens = parseWordTokens(text);
    // Cursor on second "unknown" (starts at index 17)
    const token = getTokenAtCursor(tokens, 18, text);
    expect(token).toMatchObject({ word: 'unknown', highlighted: false });
  });

  it('returns preceding token at end of text (no trailing space)', () => {
    const text = 'hello';
    const tokens = parseWordTokens(text);
    const token = getTokenAtCursor(tokens, 5, text);
    expect(token).toMatchObject({ word: 'hello' });
  });
});
