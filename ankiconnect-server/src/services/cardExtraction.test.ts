import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCardPreviews, type CardResponse } from './cardExtraction.js';
import type { AnkiNote } from 'shared';

// Mock anki service
vi.mock('./anki.js', () => ({
  searchWordCached: vi.fn(),
}));

// Mock settings
vi.mock('./settings.js', () => ({
  getSettings: vi.fn().mockResolvedValue({
    fieldMapping: {
      Word: 'Bangla',
      Definition: 'Eng_trans',
      Example: 'example sentence',
      Translation: 'sentence-trans',
    },
  }),
}));

import * as ankiService from './anki.js';

const mockSearchWord = vi.mocked(ankiService.searchWordCached);

const makeNote = (fields: Record<string, string>): AnkiNote => ({
  noteId: 123,
  modelName: 'Bangla (and reversed)',
  tags: ['auto-generated'],
  fields: Object.fromEntries(
    Object.entries(fields).map(([k, v], i) => [k, { value: v, order: i }])
  ),
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchWord.mockResolvedValue(null);
});

describe('buildCardPreviews', () => {
  it('single card, word not in Anki → alreadyExists: false', async () => {
    const cards: CardResponse[] = [
      {
        word: 'বাজার',
        definition: 'market',
        exampleSentence: 'আমি **বাজারে** যাচ্ছি।',
        sentenceTranslation: 'I am going to the market.',
      },
    ];

    const previews = await buildCardPreviews(cards, 'Bangla', new Map());
    expect(previews).toHaveLength(1);
    expect(previews[0]!.word).toBe('বাজার');
    expect(previews[0]!.definition).toBe('market');
    expect(previews[0]!.alreadyExists).toBe(false);
    expect(previews[0]!.existingCard).toBeUndefined();
  });

  it('single card, word already in Anki → alreadyExists: true with existingCard', async () => {
    const existingNote = makeNote({
      Bangla: 'বাজার',
      Eng_trans: 'bazaar, market',
      'example sentence': 'সে <b>বাজারে</b> গেছে।',
      'sentence-trans': 'He went to the market.',
    });
    const ankiResults = new Map<string, AnkiNote | null>([['বাজার', existingNote]]);
    const cards: CardResponse[] = [
      {
        word: 'বাজার',
        definition: 'market',
        exampleSentence: 'আমি **বাজারে** যাচ্ছি।',
        sentenceTranslation: 'I am going to the market.',
      },
    ];

    const previews = await buildCardPreviews(cards, 'Bangla', ankiResults);
    expect(previews).toHaveLength(1);
    expect(previews[0]!.alreadyExists).toBe(true);
    expect(previews[0]!.existingCard).toEqual({
      word: 'বাজার',
      definition: 'bazaar, market',
      exampleSentence: 'সে <b>বাজারে</b> গেছে।',
      sentenceTranslation: 'He went to the market.',
    });
  });

  it('multiple cards with mixed Anki results', async () => {
    const existingNote = makeNote({
      Bangla: 'বাজার',
      Eng_trans: 'market',
      'example sentence': '',
      'sentence-trans': '',
    });
    const ankiResults = new Map<string, AnkiNote | null>([
      ['বাজার', existingNote],
      ['যাওয়া', null],
    ]);
    const cards: CardResponse[] = [
      {
        word: 'বাজার',
        definition: 'market',
        exampleSentence: 'আমি **বাজারে** যাচ্ছি।',
        sentenceTranslation: 'I am going to the market.',
      },
      {
        word: 'যাওয়া',
        definition: 'to go',
        exampleSentence: 'আমি স্কুলে **যাচ্ছি**।',
        sentenceTranslation: 'I am going to school.',
      },
    ];

    const previews = await buildCardPreviews(cards, 'Bangla', ankiResults);
    expect(previews).toHaveLength(2);
    expect(previews[0]!.alreadyExists).toBe(true);
    expect(previews[0]!.existingCard).toBeDefined();
    expect(previews[1]!.alreadyExists).toBe(false);
    expect(previews[1]!.existingCard).toBeUndefined();
  });

  it('rootWord and spellingCorrection fields passed through', async () => {
    const cards: CardResponse[] = [
      {
        word: 'বাজার',
        definition: 'market',
        exampleSentence: 'আমি **বাজারে** যাচ্ছি।',
        sentenceTranslation: 'I am going to the market.',
        rootWord: 'বাজ — hawk',
        spellingCorrection: 'বাজর → বাজার',
      },
    ];

    const previews = await buildCardPreviews(cards, 'Bangla', new Map());
    expect(previews[0]!.rootWord).toBe('বাজ — hawk');
    expect(previews[0]!.spellingCorrection).toBe('বাজর → বাজার');
  });

  it('checks Anki for words not already in results map', async () => {
    const note = makeNote({
      Bangla: 'খাওয়া',
      Eng_trans: 'to eat',
      'example sentence': '',
      'sentence-trans': '',
    });
    mockSearchWord.mockResolvedValue(note);

    const cards: CardResponse[] = [
      {
        word: 'খাওয়া',
        definition: 'to eat',
        exampleSentence: 'সে ভাত **খাচ্ছে**।',
        sentenceTranslation: 'He is eating rice.',
      },
    ];

    const previews = await buildCardPreviews(cards, 'Bangla', new Map());
    expect(mockSearchWord).toHaveBeenCalledWith('খাওয়া', 'Bangla');
    expect(previews[0]!.alreadyExists).toBe(true);
    expect(previews[0]!.existingCard).toBeDefined();
  });

  it('spelling correction is applied to exampleSentence', async () => {
    const cards: CardResponse[] = [
      {
        word: 'কাঁদা',
        definition: 'to cry',
        exampleSentence: 'বাচ্চাটা **কাদছে** কারণ সে পড়ে গেছে।',
        sentenceTranslation: 'The child is crying because he fell.',
        spellingCorrection: 'কাদছে → কাঁদছে',
      },
    ];

    const previews = await buildCardPreviews(cards, 'Bangla', new Map());
    expect(previews[0]!.exampleSentence).toBe('বাচ্চাটা **কাঁদছে** কারণ সে পড়ে গেছে।');
    expect(previews[0]!.spellingCorrection).toBe('কাদছে → কাঁদছে');
  });

  it('cached offline results (noteId=0) show alreadyExists but no existingCard', async () => {
    const cachedNote: AnkiNote = {
      noteId: 0,
      modelName: '',
      tags: [],
      fields: {},
    };
    const ankiResults = new Map<string, AnkiNote | null>([['বাজার', cachedNote]]);
    const cards: CardResponse[] = [
      {
        word: 'বাজার',
        definition: 'market',
        exampleSentence: 'আমি **বাজারে** যাচ্ছি।',
        sentenceTranslation: 'I am going to the market.',
      },
    ];

    const previews = await buildCardPreviews(cards, 'Bangla', ankiResults);
    expect(previews[0]!.alreadyExists).toBe(true);
    expect(previews[0]!.existingCard).toBeUndefined();
  });
});
