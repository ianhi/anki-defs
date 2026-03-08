import { describe, it, expect } from 'vitest';
import {
  extractVocabularyList,
  extractSentenceTranslation,
  extractInflectedForms,
} from './cardExtraction.js';

describe('extractVocabularyList', () => {
  it('extracts comma-separated vocabulary from AI response', () => {
    const response = '**Vocabulary:** করা, যাওয়া, খাওয়া\n\nSome other content here.';
    expect(extractVocabularyList(response)).toEqual(['করা', 'যাওয়া', 'খাওয়া']);
  });

  it('returns empty array when no vocabulary line exists', () => {
    const response = 'This response has no vocabulary section.';
    expect(extractVocabularyList(response)).toEqual([]);
  });

  it('filters out empty strings from trailing commas', () => {
    const response = '**Vocabulary:** করা, যাওয়া, \n';
    expect(extractVocabularyList(response)).toEqual(['করা', 'যাওয়া']);
  });

  it('filters out entries containing asterisks', () => {
    const response = '**Vocabulary:** করা, **bold**, যাওয়া\n';
    expect(extractVocabularyList(response)).toEqual(['করা', 'যাওয়া']);
  });

  it('trims whitespace from vocabulary words', () => {
    const response = '**Vocabulary:**   করা ,  যাওয়া ,  খাওয়া  \n';
    expect(extractVocabularyList(response)).toEqual(['করা', 'যাওয়া', 'খাওয়া']);
  });

  it('handles single word vocabulary', () => {
    const response = '**Vocabulary:** করা\n';
    expect(extractVocabularyList(response)).toEqual(['করা']);
  });
});

describe('extractSentenceTranslation', () => {
  it('extracts translation with "Translation:" prefix', () => {
    const response = '**Translation:** The boy is going to the market.\n\nMore content.';
    expect(extractSentenceTranslation(response)).toBe('The boy is going to the market.');
  });

  it('extracts translation with "Sentence Translation:" prefix', () => {
    const response = '**Sentence Translation:** She is eating rice.\n\nMore content.';
    expect(extractSentenceTranslation(response)).toBe('She is eating rice.');
  });

  it('returns empty string when no translation found', () => {
    const response = 'No translation in this response.';
    expect(extractSentenceTranslation(response)).toBe('');
  });

  it('trims whitespace from translation', () => {
    const response = '**Translation:**   The boy is running.  \n';
    expect(extractSentenceTranslation(response)).toBe('The boy is running.');
  });
});

describe('extractInflectedForms', () => {
  it('extracts inflected-to-lemma mappings from word-by-word analysis', () => {
    const response = `## Word-by-word Analysis

- **বাজারে** — in the market. From **বাজার**
- **খাচ্ছে** — is eating. From **খাওয়া**`;

    const result = extractInflectedForms(response);
    expect(result.get('বাজার')).toBe('বাজারে');
    expect(result.get('খাওয়া')).toBe('খাচ্ছে');
    expect(result.size).toBe(2);
  });

  it('returns empty map when no word-by-word section exists', () => {
    const response = 'Just a plain response with no word analysis.';
    const result = extractInflectedForms(response);
    expect(result.size).toBe(0);
  });

  it('skips entries where inflected form equals lemma', () => {
    const response = `- **বাজার** — market. From **বাজার**
- **খাচ্ছে** — is eating. From **খাওয়া**`;

    const result = extractInflectedForms(response);
    expect(result.has('বাজার')).toBe(false);
    expect(result.get('খাওয়া')).toBe('খাচ্ছে');
    expect(result.size).toBe(1);
  });

  it('handles multiple inflected forms', () => {
    const response = `- **যাচ্ছে** — is going. From **যাওয়া**
- **করেছিল** — had done. From **করা**
- **কাঁদছে** — is crying. From **কাঁদা**`;

    const result = extractInflectedForms(response);
    expect(result.size).toBe(3);
    expect(result.get('যাওয়া')).toBe('যাচ্ছে');
    expect(result.get('করা')).toBe('করেছিল');
    expect(result.get('কাঁদা')).toBe('কাঁদছে');
  });

  it('maps inflected forms correctly for focused-words scenario', () => {
    // When wordsForCards contains inflected forms from the sentence and
    // Gemini returns lemmatized forms, extractInflectedForms should
    // provide the mapping from lemma -> inflected form
    const response = `## Word-by-word Analysis

- **বাজারে** — in the market. From **বাজার**
- **যাচ্ছে** — is going. From **যাওয়া**
- **খাচ্ছে** — is eating. From **খাওয়া**`;

    const inflectedForms = extractInflectedForms(response);

    // Simulating focused-words: user highlighted "বাজারে" and "যাচ্ছে"
    // The vocabulary list gives lemmas: বাজার, যাওয়া
    // inflectedForms should map lemma -> inflected so we can set inflectedForm on card
    expect(inflectedForms.get('বাজার')).toBe('বাজারে');
    expect(inflectedForms.get('যাওয়া')).toBe('যাচ্ছে');
    expect(inflectedForms.get('খাওয়া')).toBe('খাচ্ছে');
  });
});
