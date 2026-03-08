import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCardPreviews, type CardResponse } from './cardExtraction.js';

// Mock anki service
vi.mock('./anki.js', () => ({
  searchWordCached: vi.fn(),
}));

import * as ankiService from './anki.js';

const mockSearchWord = vi.mocked(ankiService.searchWordCached);

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
  });

  it('single card, word already in Anki → alreadyExists: true', async () => {
    const ankiResults = new Map<string, boolean>([['বাজার', true]]);
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
  });

  it('multiple cards with mixed Anki results', async () => {
    const ankiResults = new Map<string, boolean>([
      ['বাজার', true],
      ['যাওয়া', false],
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
    expect(previews[1]!.alreadyExists).toBe(false);
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
    mockSearchWord.mockResolvedValue({ noteId: 123 } as ReturnType<
      typeof ankiService.searchWordCached
    > extends Promise<infer T>
      ? T
      : never);

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
  });
});
