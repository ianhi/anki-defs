import * as ankiService from './anki.js';
import { getSettings } from './settings.js';
import type { AnkiNote, CardContent, CardPreview } from 'shared';

export interface CardResponse {
  word: string;
  definition: string;
  banglaDefinition: string;
  exampleSentence: string;
  sentenceTranslation: string;
  spellingCorrection?: string;
}

/**
 * Search Anki for a word, storing the full note (or null).
 * Silently stores null on errors (Anki may be offline).
 */
async function checkAnki(
  word: string,
  deck: string,
  results: Map<string, AnkiNote | null>
): Promise<void> {
  if (results.has(word)) return;
  try {
    const note = await ankiService.searchWordCached(word, deck);
    results.set(word, note);
  } catch (error) {
    console.warn('[CardExtraction] Anki search failed for "%s":', word, error);
    results.set(word, null);
  }
}

/**
 * Reverse-map an AnkiNote's fields to CardContent using the field mapping from settings.
 */
function noteToCardContent(note: AnkiNote, fieldMapping: Record<string, string>): CardContent {
  // Build reverse mapping: model field name → standard field name
  // e.g. { Bangla: "Word", Eng_trans: "Definition", ... }
  const reverseMap = new Map<string, string>();
  for (const [standard, modelField] of Object.entries(fieldMapping)) {
    reverseMap.set(modelField, standard);
  }

  const getField = (standardName: string): string => {
    // Try mapped field name first, then standard name as fallback
    const mappedName = fieldMapping[standardName] || standardName;
    return note.fields[mappedName]?.value || '';
  };

  return {
    word: getField('Word'),
    definition: getField('Definition'),
    banglaDefinition: getField('BanglaDefinition'),
    exampleSentence: getField('Example'),
    sentenceTranslation: getField('Translation'),
  };
}

/**
 * Parse a spellingCorrection like "কাদছে → কাঁদছে" and apply it to the example sentence.
 * Replaces the misspelled form with the corrected form (preserving **bold** markers).
 */
function applySpellingCorrection(sentence: string, correction: string): string {
  const match = correction.match(/^(.+?)\s*→\s*(.+)$/);
  if (!match) return sentence;
  const [, wrong, right] = match;
  // Replace both bare and **bold** occurrences
  return sentence.replace(wrong!, right!).replace(`**${wrong}**`, `**${right}**`);
}

/**
 * Build CardPreview[] from parsed AI card responses + Anki duplicate check results.
 */
export async function buildCardPreviews(
  cards: CardResponse[],
  targetDeck: string,
  ankiResults: Map<string, AnkiNote | null>
): Promise<CardPreview[]> {
  // Check Anki for any words we haven't checked yet
  await Promise.all(
    cards
      .filter((card) => !ankiResults.has(card.word))
      .map((card) => checkAnki(card.word, targetDeck, ankiResults))
  );

  const settings = await getSettings();
  const fieldMapping = settings.fieldMapping || {};

  return cards.map((card) => {
    const existingNote = ankiResults.get(card.word);
    const existingCard =
      existingNote && existingNote.noteId !== 0
        ? noteToCardContent(existingNote, fieldMapping)
        : undefined;

    // Apply spelling correction to the example sentence if present
    const exampleSentence = card.spellingCorrection
      ? applySpellingCorrection(card.exampleSentence, card.spellingCorrection)
      : card.exampleSentence;

    return {
      word: card.word,
      definition: card.definition,
      banglaDefinition: card.banglaDefinition,
      exampleSentence,
      sentenceTranslation: card.sentenceTranslation,
      spellingCorrection: card.spellingCorrection,
      alreadyExists: !!existingNote,
      existingCard,
    };
  });
}
