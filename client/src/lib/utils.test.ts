import { describe, it, expect } from 'vitest';
import { boldWordInSentence } from './utils';

describe('boldWordInSentence', () => {
  it('wraps target word in bold tags', () => {
    expect(boldWordInSentence('The cat sat', 'cat')).toBe('The <b>cat</b> sat');
  });

  it('is case-insensitive when matching', () => {
    expect(boldWordInSentence('The Cat sat', 'cat')).toBe('The <b>Cat</b> sat');
  });

  it('returns escaped sentence when word not found', () => {
    expect(boldWordInSentence('The cat sat', 'dog')).toBe('The cat sat');
  });

  it('returns sentence as-is when sentence is empty', () => {
    expect(boldWordInSentence('', 'cat')).toBe('');
  });

  it('returns sentence as-is when word is empty', () => {
    expect(boldWordInSentence('The cat sat', '')).toBe('The cat sat');
  });

  it('escapes HTML in non-matched parts', () => {
    expect(boldWordInSentence('<b>cat</b> & dog', 'dog')).toBe(
      '&lt;b&gt;cat&lt;/b&gt; &amp; <b>dog</b>'
    );
  });

  it('escapes HTML in the matched word too', () => {
    expect(boldWordInSentence('a <b> c', '<b>')).toBe('a <b>&lt;b&gt;</b> c');
  });

  it('works with Bangla text', () => {
    expect(boldWordInSentence('ছেলেটা বাজারে যাচ্ছে', 'বাজারে')).toBe(
      'ছেলেটা <b>বাজারে</b> যাচ্ছে'
    );
  });
});
