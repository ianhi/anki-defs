// Focus/highlight logic for marking unknown words in sentences.
// Source of truth is inline **word** markers in the text string.

export interface WordToken {
  word: string; // clean word (no ** or stray *)
  raw: string; // original matched text including any **
  highlighted: boolean;
  start: number;
  end: number;
}

/** Parse highlighted words from text (marked with **) */
export function parseHighlightedWords(text: string): string[] {
  const matches = text.match(/\*\*([^*]+)\*\*/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(2, -2).trim()).filter(Boolean);
}

/** Remove highlight markers for clean text */
export function getCleanText(text: string): string {
  return text.replace(/\*\*/g, '');
}

/** Parse text into word tokens with highlight state and position */
export function parseWordTokens(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  // Match **word**, or *-prefixed partial like *word or **word, or plain words
  const regex = /\*\*([^*]+)\*\*|\*{0,2}(\S+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1] !== undefined) {
      tokens.push({
        word: match[1],
        raw: match[0],
        highlighted: true,
        start: match.index,
        end: match.index + match[0].length,
      });
    } else if (match[2] !== undefined) {
      tokens.push({
        word: match[2].replace(/\*/g, ''),
        raw: match[0],
        highlighted: false,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return tokens;
}

/** Toggle focus on a token: add ** if unfocused, remove ** if focused.
 *  Always ensures a space after closing ** when focusing. */
export function toggleTokenInText(text: string, token: WordToken): string {
  if (token.highlighted) {
    // Remove ** markers
    return text.slice(0, token.start) + token.word + text.slice(token.end);
  } else {
    // Add ** markers, using clean word (strips any stray *)
    const after = text.slice(token.end);
    const needsSpace = !/^\s/.test(after);
    return text.slice(0, token.start) + '**' + token.word + '**' + (needsSpace ? ' ' : '') + after;
  }
}

/** Find the word token at cursor, falling back to preceding token on whitespace
 *  (handles mobile auto-space after typing). */
export function getTokenAtCursor(
  tokens: WordToken[],
  cursorPos: number,
  text: string
): WordToken | null {
  for (const token of tokens) {
    if (cursorPos >= token.start && cursorPos <= token.end) {
      return token;
    }
  }
  const ch = text[cursorPos];
  if (cursorPos > 0 && (cursorPos >= text.length || (ch !== undefined && /\s/.test(ch)))) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      if (t && t.end <= cursorPos) {
        return t;
      }
    }
  }
  return null;
}

// --- English-to-Bangla detection ---

const LATIN_ONLY_RE = /^[a-zA-Z\s.,!?'"()\-:;*]+$/;

/** Detect if input should use English→Bangla mode based on prefix or Latin script. */
export function isEnglishToBangla(text: string, prefix: string, autoDetect: boolean): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const hasPrefix = trimmed.toLowerCase().startsWith(prefix.toLowerCase());
  const isLatin = LATIN_ONLY_RE.test(trimmed);
  return hasPrefix || (autoDetect && isLatin);
}
