import * as gemini from './gemini.js';
import * as ankiService from './anki.js';
import type { CardPreview } from 'shared';

type CardPreviewData = Omit<CardPreview, 'alreadyExists'>;

interface ExtractionInput {
  wordsForCards: string[];
  fullResponse: string;
  originalSentence: string;
  sentenceTranslation: string;
  isSentenceMode: boolean;
  targetDeck: string;
  /** Pre-populated Anki results from earlier checks */
  ankiResults: Map<string, boolean>;
}

export interface ExtractionResult {
  cardPreviews: CardPreview[];
  errors: string[];
}

/**
 * Search Anki for a word, returning whether it exists.
 * Silently returns false on errors (Anki may be offline).
 */
async function checkAnki(word: string, deck: string, results: Map<string, boolean>): Promise<void> {
  if (results.has(word)) return;
  try {
    const note = await ankiService.searchWord(word, deck);
    results.set(word, !!note);
  } catch (error) {
    console.warn('[CardExtraction] Anki search failed for "%s":', word, error);
  }
}

/**
 * Extract card data for each word and check Anki for duplicates.
 * Returns card previews ready to send to the client.
 */
export async function extractCards(input: ExtractionInput): Promise<ExtractionResult> {
  const {
    wordsForCards,
    fullResponse,
    originalSentence,
    sentenceTranslation,
    isSentenceMode,
    targetDeck,
    ankiResults,
  } = input;
  const errors: string[] = [];

  if (wordsForCards.length === 0) {
    return { cardPreviews: [], errors };
  }

  // Check Anki for any words we haven't checked yet (sentence vocab)
  await Promise.all(
    wordsForCards
      .filter((word) => !ankiResults.has(word))
      .map((word) => checkAnki(word, targetDeck, ankiResults))
  );

  // Extract card data in parallel via Gemini structured output
  const results = await Promise.allSettled(
    wordsForCards.map(async (word): Promise<{ word: string; cardData: CardPreviewData }> => {
      const cardData = isSentenceMode
        ? await gemini.extractCardDataFromSentence(
            word,
            originalSentence,
            sentenceTranslation,
            fullResponse
          )
        : await gemini.extractCardData(word, fullResponse);
      return { word, cardData };
    })
  );

  // Check Anki for lemmatized forms (extraction may return a different lemma)
  await Promise.all(
    results.map(async (result) => {
      if (result.status !== 'fulfilled') return;
      const lemma = result.value.cardData.word;
      if (lemma !== result.value.word) {
        await checkAnki(lemma, targetDeck, ankiResults);
      }
    })
  );

  // Build card previews
  const cardPreviews: CardPreview[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { word, cardData } = result.value;
      const lemmaDiffers = cardData.word !== word;
      cardPreviews.push({
        ...cardData,
        inflectedForm: lemmaDiffers ? word : undefined,
        alreadyExists: ankiResults.get(cardData.word) || ankiResults.get(word) || false,
        lemmaMismatch: lemmaDiffers,
        originalLemma: lemmaDiffers ? word : undefined,
      });
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error('[CardExtraction] Failed:', msg);
      errors.push(msg);
    }
  }

  return { cardPreviews, errors };
}

// Re-export extraction helpers for use in routes
export { extractVocabularyList, extractSentenceTranslation };

/** Extract vocabulary list from AI response (for sentence mode) */
function extractVocabularyList(response: string): string[] {
  const match = response.match(/\*\*Vocabulary:\*\*\s*([^\n]+)/i);
  if (!match || !match[1]) return [];

  return match[1]
    .split(',')
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !w.includes('*'));
}

/** Extract sentence translation from AI response */
function extractSentenceTranslation(response: string): string {
  const match = response.match(/\*\*(?:Sentence )?Translation:\*\*\s*([^\n]+)/i);
  return match?.[1]?.trim() || '';
}
