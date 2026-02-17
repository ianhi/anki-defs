import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Wrap the target word in <b> tags for Anki HTML rendering
export function boldWordInSentence(sentence: string, word: string): string {
  if (!sentence || !word) return sentence;

  const lowerSentence = sentence.toLowerCase();
  const lowerWord = word.toLowerCase();
  const index = lowerSentence.indexOf(lowerWord);

  if (index === -1) return escapeHtml(sentence);

  const before = escapeHtml(sentence.slice(0, index));
  const match = escapeHtml(sentence.slice(index, index + word.length));
  const after = escapeHtml(sentence.slice(index + word.length));

  return `${before}<b>${match}</b>${after}`;
}
