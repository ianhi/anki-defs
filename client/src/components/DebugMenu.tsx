import { useState } from 'react';
import { Button } from './ui/Button';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';

interface DebugMenuProps {
  onSelectExample: (text: string, highlightedWords?: string[]) => void;
  disabled?: boolean;
}

const EXAMPLES = {
  words: [
    { label: 'জল (water)', value: 'জল' },
    { label: 'খাওয়া (to eat)', value: 'খাওয়া' },
    { label: 'ভালোবাসা (love)', value: 'ভালোবাসা' },
    { label: 'সুন্দর (beautiful)', value: 'সুন্দর' },
  ],
  sentences: [
    { label: 'I have drunk water', value: 'আমি জল খেয়েছি' },
    { label: 'She is going home', value: 'সে বাড়ি যাচ্ছে' },
    { label: 'I like to read books', value: 'আমি বই পড়তে ভালোবাসি' },
    { label: 'The weather is nice today', value: 'আজ আবহাওয়া ভালো' },
  ],
  highlighted: [
    {
      label: 'Highlight: খেয়েছি',
      value: 'আমি জল খেয়েছি',
      highlighted: ['খেয়েছি'],
    },
    {
      label: 'Highlight: যাচ্ছে',
      value: 'সে বাড়ি যাচ্ছে',
      highlighted: ['যাচ্ছে'],
    },
    {
      label: 'Highlight: multiple',
      value: 'আমি বই পড়তে ভালোবাসি',
      highlighted: ['বই', 'ভালোবাসি'],
    },
  ],
};

export function DebugMenu({ onSelectExample, disabled }: DebugMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-dashed border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-2 py-1 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30"
      >
        <Bug className="h-3 w-3" />
        Debug Menu
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {isOpen && (
        <div className="p-3 space-y-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Single Words</div>
            <div className="flex flex-wrap gap-1">
              {EXAMPLES.words.map((ex) => (
                <Button
                  key={ex.value}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => onSelectExample(ex.value)}
                  disabled={disabled}
                >
                  {ex.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Sentences</div>
            <div className="flex flex-wrap gap-1">
              {EXAMPLES.sentences.map((ex) => (
                <Button
                  key={ex.value}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => onSelectExample(ex.value)}
                  disabled={disabled}
                >
                  {ex.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              With Highlighted Words
            </div>
            <div className="flex flex-wrap gap-1">
              {EXAMPLES.highlighted.map((ex) => (
                <Button
                  key={ex.label}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 border-yellow-500"
                  onClick={() => onSelectExample(ex.value, ex.highlighted)}
                  disabled={disabled}
                >
                  {ex.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
