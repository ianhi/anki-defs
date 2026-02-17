import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Wrap the target word in <b> tags for Anki HTML rendering
export function boldWordInSentence(sentence: string, word: string): string {
  if (!sentence || !word) return sentence;

  const lowerSentence = sentence.toLowerCase();
  const lowerWord = word.toLowerCase();
  const index = lowerSentence.indexOf(lowerWord);

  if (index === -1) return sentence;

  const before = sentence.slice(0, index);
  const match = sentence.slice(index, index + word.length);
  const after = sentence.slice(index + word.length);

  return `${before}<b>${match}</b>${after}`;
}
