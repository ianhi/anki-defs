import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
 * Convert **word** markers to cloze syntax, handling multiple markers.
 * Returns the converted text and the number of cloze deletions created.
 * Kept for display formatting in CardPreview; the server builds actual
 * cloze fields on its own.
 */
export function sentenceToCloze(sentence: string, startIndex = 1): { text: string; count: number } {
  let idx = startIndex;
  const text = sentence.replace(/\*\*([^*]+)\*\*/g, (_match, word: string) => {
    return `{{c${idx++}::${word}}}`;
  });
  return { text, count: idx - startIndex };
}
