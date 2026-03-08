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

  it('bolds one specific word when sentence has multiple Bangla words', () => {
    // Focused-words: user highlights only one word from a multi-word sentence
    expect(boldWordInSentence('সে বাজারে যাচ্ছে আর খাচ্ছে', 'যাচ্ছে')).toBe(
      'সে বাজারে <b>যাচ্ছে</b> আর খাচ্ছে'
    );
  });

  it('bolds inflected form when it differs from lemma', () => {
    // In focused-words mode, the inflected form (e.g. বাজারে) is used for bolding
    // even though the card's word is the lemma (বাজার)
    const sentence = 'ছেলেটা বাজারে যাচ্ছে';
    const inflectedForm = 'বাজারে'; // not the lemma বাজার
    expect(boldWordInSentence(sentence, inflectedForm)).toBe('ছেলেটা <b>বাজারে</b> যাচ্ছে');
  });

  it('bolds only the first occurrence when word appears multiple times', () => {
    expect(boldWordInSentence('cat and cat', 'cat')).toBe('<b>cat</b> and cat');
  });
});
