import * as gemini from './gemini.js';
import type { ExtractionUsage } from './gemini.js';
import * as ankiService from './anki.js';
import type { CardPreview } from 'shared';

interface ExtractionInput {
  wordsForCards: string[];
  fullResponse: string;
  originalSentence: string;
  sentenceTranslation: string;
  isSentenceMode: boolean;
  targetDeck: string;
  /** Pre-populated Anki results from earlier checks */
  ankiResults: Map<string, boolean>;
  /** Map of lemma → inflected form from the AI response (for sentence highlighting) */
  inflectedForms?: Map<string, string>;
}

export interface ExtractionResult {
  cardPreviews: CardPreview[];
  errors: string[];
  totalUsage?: ExtractionUsage;
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
    inflectedForms,
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
    wordsForCards.map(async (word) => {
      const result = isSentenceMode
        ? await gemini.extractCardDataFromSentence(
            word,
            originalSentence,
            sentenceTranslation,
            fullResponse
          )
        : await gemini.extractCardData(word, fullResponse);
      return { word, cardData: result.card, usage: result.usage };
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

  // Aggregate extraction usage across all calls
  const totalUsage: ExtractionUsage = { inputTokens: 0, outputTokens: 0 };
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.usage) {
      totalUsage.inputTokens += result.value.usage.inputTokens;
      totalUsage.outputTokens += result.value.usage.outputTokens;
    }
  }

  // Build card previews
  const cardPreviews: CardPreview[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { word, cardData } = result.value;
      const lemmaDiffers = cardData.word !== word;
      // For sentence mode: if wordsForCards are already lemmas (from Vocabulary line),
      // look up the inflected form from the word-by-word analysis
      const inflected = lemmaDiffers
        ? word
        : inflectedForms?.get(word) || inflectedForms?.get(cardData.word) || undefined;
      cardPreviews.push({
        ...cardData,
        inflectedForm: inflected,
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

  return {
    cardPreviews,
    errors,
    totalUsage: totalUsage.inputTokens > 0 || totalUsage.outputTokens > 0 ? totalUsage : undefined,
  };
}

// Re-export extraction helpers for use in routes
export { extractVocabularyList, extractSentenceTranslation, extractInflectedForms };

/** Extract vocabulary list from AI response (for sentence mode) */
function extractVocabularyList(response: string): string[] {
  const vocabMatch = response.match(/\*\*Vocabulary:\*\*\s*([^\n]+)/i);
  if (!vocabMatch || !vocabMatch[1]) return [];

  return vocabMatch[1]
    .split(',')
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !w.includes('*'));
}

/** Extract sentence translation from AI response */
function extractSentenceTranslation(response: string): string {
  const transMatch = response.match(/\*\*(?:Sentence )?Translation:\*\*\s*([^\n]+)/i);
  return transMatch?.[1]?.trim() || '';
}

/**
 * Extract inflected-to-lemma mappings from the Word-by-word section.
 * Pattern: - **[inflected word]** — ... From **[lemma]**
 * Returns a map of lemma to inflected form (for highlighting the original sentence).
 */
function extractInflectedForms(response: string): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = /- \*\*([^*]+)\*\*[^]*?From \*\*([^*]+)\*\*/g;
  let found = pattern.exec(response);
  while (found !== null) {
    const inflected = found[1]?.trim();
    const lemma = found[2]?.trim();
    if (inflected && lemma && inflected !== lemma) {
      result.set(lemma, inflected);
    }
    found = pattern.exec(response);
  }
  return result;
}
