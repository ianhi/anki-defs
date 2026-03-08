import * as ankiService from './anki.js';
import type { CardPreview } from 'shared';

export interface CardResponse {
  word: string;
  definition: string;
  exampleSentence: string;
  sentenceTranslation: string;
  rootWord?: string;
  spellingCorrection?: string;
}

/**
 * Search Anki for a word, returning whether it exists.
 * Silently returns false on errors (Anki may be offline).
 */
async function checkAnki(word: string, deck: string, results: Map<string, boolean>): Promise<void> {
  if (results.has(word)) return;
  try {
    const note = await ankiService.searchWordCached(word, deck);
    results.set(word, !!note);
  } catch (error) {
    console.warn('[CardExtraction] Anki search failed for "%s":', word, error);
  }
}

/**
 * Build CardPreview[] from parsed AI card responses + Anki duplicate check results.
 */
export async function buildCardPreviews(
  cards: CardResponse[],
  targetDeck: string,
  ankiResults: Map<string, boolean>
): Promise<CardPreview[]> {
  // Check Anki for any words we haven't checked yet
  await Promise.all(
    cards
      .filter((card) => !ankiResults.has(card.word))
      .map((card) => checkAnki(card.word, targetDeck, ankiResults))
  );

  return cards.map((card) => ({
    word: card.word,
    definition: card.definition,
    exampleSentence: card.exampleSentence,
    sentenceTranslation: card.sentenceTranslation,
    rootWord: card.rootWord,
    spellingCorrection: card.spellingCorrection,
    alreadyExists: ankiResults.get(card.word) || false,
  }));
}
