import { useState, useRef, type KeyboardEvent } from 'react';
import { Button } from './ui/Button';
import { Send, Highlighter } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string, highlightedWords?: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Parse highlighted words from text (marked with **)
function parseHighlightedWords(text: string): string[] {
  const matches = text.match(/\*\*([^*]+)\*\*/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(2, -2).trim()).filter(Boolean);
}

// Remove highlight markers for display
function getCleanText(text: string): string {
  return text.replace(/\*\*/g, '');
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a Bangla word or sentence... (Ctrl+B to highlight unknown words)',
}: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      const highlightedWords = parseHighlightedWords(trimmed);
      const cleanText = getCleanText(trimmed);
      onSend(cleanText, highlightedWords.length > 0 ? highlightedWords : undefined);
      setValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleHighlight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) return; // No selection

    const selectedText = value.slice(start, end);

    // Check if already highlighted
    const beforeStart = value.slice(Math.max(0, start - 2), start);
    const afterEnd = value.slice(end, end + 2);

    if (beforeStart === '**' && afterEnd === '**') {
      // Remove highlight
      const newValue = value.slice(0, start - 2) + selectedText + value.slice(end + 2);
      setValue(newValue);
      // Restore selection
      setTimeout(() => {
        textarea.setSelectionRange(start - 2, end - 2);
        textarea.focus();
      }, 0);
    } else {
      // Add highlight
      const newValue = value.slice(0, start) + '**' + selectedText + '**' + value.slice(end);
      setValue(newValue);
      // Restore selection (accounting for added **)
      setTimeout(() => {
        textarea.setSelectionRange(start + 2, end + 2);
        textarea.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleHighlight();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const highlightedWords = parseHighlightedWords(value);

  return (
    <div className="border-t border-border p-4">
      <div className="max-w-4xl mx-auto space-y-2">
        {highlightedWords.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Highlighter className="h-4 w-4 text-yellow-500" />
            <span className="text-muted-foreground">Focus words:</span>
            <div className="flex gap-1 flex-wrap">
              {highlightedWords.map((word, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-xs font-medium"
                >
                  {word}
                </span>
              ))}
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
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleHighlight}
            disabled={disabled}
            title="Highlight selection (Ctrl+B)"
          >
            <Highlighter className="h-4 w-4" />
          </Button>
          <Button onClick={handleSubmit} disabled={disabled || !value.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Select text and press <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+B</kbd> to mark
          unknown words for focused definitions
        </p>
      </div>
    </div>
  );
}
