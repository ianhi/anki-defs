import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Button } from './ui/Button';
import { Crosshair, Send } from 'lucide-react';
import {
  type WordToken,
  parseWordTokens,
  toggleTokenInText,
  getTokenAtCursor,
  parseHighlightedWords,
  getCleanText,
} from '../lib/focus';
import { useSettingsStore } from '@/hooks/useSettings';

interface MessageInputProps {
  onSend: (message: string, mode?: 'english-to-bangla') => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Bangla word or sentence...',
}: MessageInputProps) {
  const [value, setValue] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [hasSelection, setHasSelection] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { settings } = useSettingsStore();

  // Detect English→Bangla mode
  const prefix = settings.englishToBanglaPrefix || 'bn:';
  const hasPrefix = value.trimStart().toLowerCase().startsWith(prefix.toLowerCase());
  const isLatinOnly = /^[a-zA-Z\s.,!?'"()\-:;]+$/.test(value.trim());
  const isEnglishToBangla =
    value.trim().length > 0 && (hasPrefix || (settings.autoDetectEnglish && isLatinOnly));

  // Listen for external "set input" events (e.g. clicking a Bangla definition)
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as globalThis.CustomEvent<string>).detail;
      if (text) {
        setValue(text);
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('setInput', handler);
    return () => window.removeEventListener('setInput', handler);
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();

    if (isEnglishToBangla) {
      // Strip prefix if present, keep ** markers for disambiguation
      const text = hasPrefix ? trimmed.slice(prefix.length).trim() : trimmed;
      if (text && !disabled) {
        onSend(text, 'english-to-bangla');
        setValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
      return;
    }

    const clean = getCleanText(trimmed);
    const blocked = clean.includes(' ') && parseHighlightedWords(trimmed).length === 0;
    if (trimmed && !disabled && !blocked) {
      // Send raw text with ** markers — they are the source of truth for focus
      onSend(trimmed);
      setValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleToggleAndRestoreCursor = (token: WordToken) => {
    const newValue = toggleTokenInText(value, token);
    setValue(newValue);

    // Place cursor after the toggled word (past closing ** and any space)
    const textarea = textareaRef.current;
    if (textarea) {
      let newCursorPos: number;
      if (token.highlighted) {
        // Was focused, now unfocused: ** removed, cursor after the clean word
        newCursorPos = token.start + token.word.length;
      } else {
        // Was unfocused, now focused: ** added, cursor after closing **
        newCursorPos = token.start + token.word.length + 4; // 4 = two **
        // Skip past space if one follows
        if (newValue[newCursorPos] === ' ') newCursorPos++;
      }
      setTimeout(() => {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }
  };

  const handleFocusToggle = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // No selection — toggle the word at cursor
    if (start === end) {
      const tokens = parseWordTokens(value);
      const token = getTokenAtCursor(tokens, start, value);
      if (token) handleToggleAndRestoreCursor(token);
      return;
    }

    // Has selection — trim trailing whitespace from selection, then find/build token
    let selEnd = end;
    while (selEnd > start && /\s/.test(value[selEnd - 1] ?? '')) selEnd--;
    if (selEnd === start) return;

    const selectedRaw = value.slice(start, selEnd);
    const selectedClean = selectedRaw.replace(/\*/g, '');
    if (!selectedClean) return;

    // Check if selection is inside ** markers
    const beforeStart = value.slice(Math.max(0, start - 2), start);
    const afterEnd = value.slice(selEnd, selEnd + 2);
    const isHighlighted = beforeStart === '**' && afterEnd === '**';

    const token: WordToken = {
      word: selectedClean,
      raw: isHighlighted ? '**' + selectedRaw + '**' : selectedRaw,
      highlighted: isHighlighted,
      start: isHighlighted ? start - 2 : start,
      end: isHighlighted ? selEnd + 2 : selEnd,
    };

    handleToggleAndRestoreCursor(token);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleFocusToggle();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      setCursorPos(textarea.selectionStart);
      setHasSelection(textarea.selectionStart !== textarea.selectionEnd);
    }
  };

  const wordTokens = parseWordTokens(value);
  const cursorToken = getTokenAtCursor(wordTokens, cursorPos, value);
  const previewToken = cursorToken && !cursorToken.highlighted ? cursorToken : null;
  const showFocusBar = value.trim().length > 0;

  // Block submission when input has spaces (multi-word) but no highlighted words
  // English→Bangla mode bypasses this check
  const cleanText = getCleanText(value).trim();
  const hasSpaces = cleanText.includes(' ');
  const highlightedWords = parseHighlightedWords(value);
  const needsHighlight = !isEnglishToBangla && hasSpaces && highlightedWords.length === 0;

  const handlePreviewTap = () => {
    if (previewToken) {
      handleToggleAndRestoreCursor(previewToken);
    }
  };

  const handleBadgeTap = (token: WordToken) => {
    handleToggleAndRestoreCursor(token);
  };

  // Get only the highlighted tokens for badge display
  const highlightedTokens = wordTokens.filter((t) => t.highlighted);

  return (
    <div className="border-t border-border p-2 sm:p-4">
      <div className="max-w-4xl mx-auto space-y-2">
        {isEnglishToBangla && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">
              EN → বাংলা
            </span>
            <span className="text-muted-foreground">
              {hasPrefix ? 'prefix detected' : 'auto-detected'}
              {hasSpaces && highlightedWords.length === 0 ? ' · tap words to disambiguate' : ''}
            </span>
          </div>
        )}
        {showFocusBar && (
          <div className="flex items-center gap-2 text-sm min-h-[28px]">
            <span className="text-muted-foreground shrink-0">Focus:</span>
            <div className="flex gap-1 flex-wrap items-center">
              {highlightedTokens.map((token) => (
                <button
                  key={`${token.start}-${token.word}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleBadgeTap(token);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-xs font-medium hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors"
                  title="Tap to unfocus"
                >
                  {token.word}
                  <span className="text-yellow-500 dark:text-yellow-400 text-[10px] leading-none">
                    ✕
                  </span>
                </button>
              ))}
              {highlightedTokens.length === 0 && !previewToken && (
                <span className="text-xs text-muted-foreground italic">
                  tap a word below to mark as unknown
                </span>
              )}
              {previewToken && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePreviewTap();
                  }}
                  className="px-2 py-0.5 rounded text-xs font-medium border border-dashed border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-950 hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
                >
                  + {previewToken.word}
                </button>
              )}
            </div>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onSelect={handleSelectionChange}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={`flex-1 resize-none rounded-lg border bg-background px-3 py-2 sm:px-4 sm:py-3 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 ${isEnglishToBangla ? 'border-blue-400 dark:border-blue-600' : 'border-input'}`}
          />
          <Button
            onMouseDown={(e) => {
              e.preventDefault();
              handleFocusToggle();
            }}
            disabled={disabled || !hasSelection}
            size="icon"
            variant="outline"
            aria-label="Focus selected text"
            className="sm:hidden"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={disabled || !value.trim() || needsHighlight}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {needsHighlight && (
          <p className="text-xs text-muted-foreground mt-1">
            Mark unknown words with Ctrl+B or tap them above
          </p>
        )}
      </div>
    </div>
  );
}
