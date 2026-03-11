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
