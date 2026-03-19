import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CardContent } from 'shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build the Anki note fields object from card content. Single source of truth for field mapping. */
export function buildNoteFields(
  card: CardContent,
  overrides?: { word?: string; definition?: string }
): Record<string, string> {
  return {
    Word: overrides?.word ?? card.word,
    Definition: overrides?.definition ?? card.definition,
    BanglaDefinition: card.banglaDefinition,
    Example: markdownBoldToHtml(card.exampleSentence),
    Translation: card.sentenceTranslation,
  };
}

// Convert **word** markdown bold markers to <b>word</b> HTML for Anki
export function markdownBoldToHtml(text: string): string {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .map((part) => {
      const match = part.match(/^\*\*([^*]+)\*\*$/);
      return match?.[1] ? `<b>${escapeHtml(match[1])}</b>` : escapeHtml(part);
    })
    .join('');
}

/**
 * Convert **word** markers to Anki cloze syntax {{c1::word}}.
 * When clozeIndex is provided, uses that number; otherwise starts at 1.
 */
export function markdownBoldToCloze(text: string, clozeIndex = 1): string {
  let idx = clozeIndex;
  return text.replace(/\*\*([^*]+)\*\*/g, () => {
    return `{{c${idx++}::${text.match(/\*\*([^*]+)\*\*/)?.[1] ?? ''}}}`;
  });
}

/**
 * Convert **word** markers to cloze syntax, handling multiple markers.
 * Returns the converted text and the number of cloze deletions created.
 */
export function sentenceToCloze(sentence: string, startIndex = 1): { text: string; count: number } {
  let idx = startIndex;
  const text = sentence.replace(/\*\*([^*]+)\*\*/g, (_match, word: string) => {
    return `{{c${idx++}::${word}}}`;
  });
  return { text, count: idx - startIndex };
}

/** Build Anki note fields for a basic cloze card. */
export function buildClozeFields(
  card: CardContent,
  fieldMapping: Record<string, string>
): Record<string, string> {
  const { text } = sentenceToCloze(card.exampleSentence);
  const fields: Record<string, string> = {};

  // Map our standard cloze fields to the user's note type fields
  const map = (key: string, value: string) => {
    const ankiField = fieldMapping[key];
    if (ankiField) fields[ankiField] = value;
  };

  map('Text', text);
  map('Translation', card.sentenceTranslation);
  map('FullSentence', card.exampleSentence.replace(/\*\*/g, ''));
  map('Word', card.word);
  map('Definition', card.definition);
  map('BanglaDefinition', card.banglaDefinition);

  return fields;
}

/** Standard cloze field names for field mapping UI. */
export const CLOZE_DATA_FIELDS = [
  'Text',
  'Translation',
  'FullSentence',
  'Word',
  'Definition',
  'BanglaDefinition',
] as const;

/** Standard MC cloze field names for field mapping UI. */
export const MC_CLOZE_DATA_FIELDS = [
  'Text',
  'FullSentence',
  'Answer',
  'AnswerDef',
  'Distractor1',
  'Distractor1Def',
  'Distractor2',
  'Distractor2Def',
  'Distractor3',
  'Distractor3Def',
  'Explanation',
] as const;

export interface Distractor {
  word: string;
  definition: string;
}

/** Build Anki note fields for an MC cloze card with distractors. */
export function buildMCClozeFields(
  card: CardContent,
  distractors: Distractor[],
  fieldMapping: Record<string, string>
): Record<string, string> {
  const { text } = sentenceToCloze(card.exampleSentence);
  const fields: Record<string, string> = {};

  const map = (key: string, value: string) => {
    const ankiField = fieldMapping[key];
    if (ankiField) fields[ankiField] = value;
  };

  map('Text', text);
  map('FullSentence', card.exampleSentence.replace(/\*\*/g, ''));
  map('Answer', card.word);
  map('AnswerDef', card.definition);
  map('Explanation', card.sentenceTranslation);

  distractors.forEach((d, i) => {
    map(`Distractor${i + 1}`, d.word);
    map(`Distractor${i + 1}Def`, d.definition);
  });

  return fields;
}
