import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { parseHighlightedWords, getCleanText } from '../lib/focus';

interface PromptResult {
  mode: string;
  systemPrompt: string;
  userMessage: string;
  extractionSystemPrompt: string;
}

const EXAMPLES = [
  { label: 'Single word', value: 'বাজার' },
  { label: 'Sentence', value: 'সে বাজারে যাচ্ছে আর খাচ্ছে' },
  { label: 'Focused words', value: 'সে **বাজারে** যাচ্ছে আর **খাচ্ছে**' },
];

async function fetchPreview(text: string): Promise<PromptResult> {
  const highlightedWords = parseHighlightedWords(text);
  const cleanText = getCleanText(text);

  const res = await fetch('/api/prompts/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      newMessage: cleanText,
      highlightedWords: highlightedWords.length > 0 ? highlightedWords : undefined,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function PromptPreview() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<PromptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Auto-preview on input change with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!input.trim()) {
      setResult(null);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setError(null);
        setResult(await fetchPreview(input));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch');
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Prompt Preview</h1>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-1">
            Input (use **word** to mark focused words)
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. সে **বাজারে** যাচ্ছে"
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {EXAMPLES.map((ex) => (
            <Button key={ex.label} variant="outline" size="sm" onClick={() => setInput(ex.value)}>
              {ex.label}
            </Button>
          ))}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>

      {result && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Mode</h2>
              <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-sm font-medium">
                {result.mode}
              </span>
            </div>
          </div>

          <PromptSection title="System Prompt" content={result.systemPrompt} />
          <PromptSection title="User Message" content={result.userMessage} />
          <PromptSection
            title="Card Extraction System Prompt"
            content={result.extractionSystemPrompt}
            defaultExpanded={false}
          />
        </div>
      )}
    </div>
  );
}

function PromptSection({
  title,
  content,
  defaultExpanded = true,
}: {
  title: string;
  content: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const lineCount = content.split('\n').length;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">
          {lineCount} lines {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded && (
        <pre className="p-4 text-sm overflow-x-auto whitespace-pre-wrap break-words bg-background">
          {content}
        </pre>
      )}
    </div>
  );
}
