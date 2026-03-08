import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { parseHighlightedWords, getCleanText } from '../lib/focus';
import { chatApi } from '../lib/api';
import type { CardPreview, TokenUsage } from 'shared';
import { Loader2, Play, Check, X } from 'lucide-react';

interface PromptResult {
  mode: string;
  systemPrompt: string;
  userMessage: string;
}

interface TestCase {
  label: string;
  value: string;
  description: string;
  checks: (cards: CardPreview[]) => CheckResult[];
}

interface CheckResult {
  label: string;
  pass: boolean;
  detail?: string;
}

const TEST_CASES: TestCase[] = [
  {
    label: 'Single word',
    value: 'বাজার',
    description: 'Basic single word lookup',
    checks: (cards) => {
      const card = cards[0];
      return [
        { label: 'Returns exactly 1 card', pass: cards.length === 1 },
        {
          label: 'Word is lemmatized',
          pass: !!card && card.word === 'বাজার',
          detail: card?.word,
        },
        {
          label: 'Has definition',
          pass: !!card && card.definition.length > 0,
          detail: card?.definition,
        },
        {
          label: 'Example has **bold** markers',
          pass: !!card && /\*\*[^*]+\*\*/.test(card.exampleSentence),
          detail: card?.exampleSentence,
        },
        {
          label: 'Has sentence translation',
          pass: !!card && card.sentenceTranslation.length > 0,
          detail: card?.sentenceTranslation,
        },
      ];
    },
  },
  {
    label: 'Colloquial spelling',
    value: 'খাইছে',
    description: 'Dialectal form of খেয়েছে — should define as-is, not "correct" to standard',
    checks: (cards) => {
      const card = cards[0];
      return [
        { label: 'Returns exactly 1 card', pass: cards.length === 1 },
        {
          label: 'Defines the colloquial word (not replaced with standard)',
          pass: !!card && card.definition.length > 0,
          detail: card ? `${card.word} — ${card.definition}` : undefined,
        },
        {
          label: 'Example has **bold** markers',
          pass: !!card && /\*\*[^*]+\*\*/.test(card.exampleSentence),
          detail: card?.exampleSentence,
        },
      ];
    },
  },
  {
    label: 'Inflected form',
    value: 'সে **বাজারে** যাচ্ছে',
    description: 'Sentence with one inflected highlight — বাজারে should lemmatize to বাজার',
    checks: (cards) => {
      const card = cards[0];
      return [
        { label: 'Returns exactly 1 card', pass: cards.length === 1 },
        {
          label: 'Word is lemmatized (বাজার, not বাজারে)',
          pass: !!card && card.word === 'বাজার',
          detail: card?.word,
        },
        {
          label: "Example sentence is the user's input",
          pass: !!card && card.exampleSentence.replace(/\*\*/g, '').includes('সে'),
          detail: card?.exampleSentence,
        },
        {
          label: 'Inflected form বাজারে is bolded (not lemma)',
          pass: !!card && card.exampleSentence.includes('**বাজারে**'),
          detail: card?.exampleSentence,
        },
      ];
    },
  },
  {
    label: 'Multiple highlights',
    value: 'সে **বাজারে** **যাচ্ছে** আর **খাচ্ছে**',
    description: 'Three highlighted words — each should get its own card with correct bolding',
    checks: (cards) => {
      return [
        { label: 'Returns 3 cards', pass: cards.length === 3 },
        {
          label: 'All cards have definitions',
          pass: cards.every((c) => c.definition.length > 0),
          detail: cards.map((c) => `${c.word}: ${c.definition}`).join(' | '),
        },
        {
          label: 'All cards use the same sentence',
          pass: cards.every((c) => c.exampleSentence.replace(/\*\*/g, '').includes('সে')),
        },
        {
          label: 'Same translation across all cards',
          pass:
            cards.length > 1 &&
            cards.every((c) => c.sentenceTranslation === cards[0]!.sentenceTranslation),
          detail: cards[0]?.sentenceTranslation,
        },
        {
          label: 'Each card bolds its own word',
          pass:
            cards.length === 3 &&
            (cards[0]?.exampleSentence.includes('**বাজারে**') ?? false) &&
            (cards[1]?.exampleSentence.includes('**যাচ্ছে**') ?? false) &&
            (cards[2]?.exampleSentence.includes('**খাচ্ছে**') ?? false),
          detail: cards
            .map((c) => {
              const m = c.exampleSentence.match(/\*\*([^*]+)\*\*/);
              return m ? m[1] : '(none)';
            })
            .join(', '),
        },
        {
          label: 'Words are lemmatized',
          pass:
            cards.length === 3 &&
            cards[0]?.word === 'বাজার' &&
            cards[1]?.word === 'যাওয়া' &&
            cards[2]?.word === 'খাওয়া',
          detail: cards.map((c) => c.word).join(', '),
        },
      ];
    },
  },
  {
    label: 'Missing chandrabindu',
    value: 'কাদা',
    description: 'কাদা (mud) vs কাঁদা (to cry) — missing ঁ is a common learner typo for "to cry"',
    checks: (cards) => {
      const card = cards[0];
      return [
        { label: 'Returns exactly 1 card', pass: cards.length === 1 },
        {
          label: 'Has definition',
          pass: !!card && card.definition.length > 0,
          detail: card ? `${card.word} — ${card.definition}` : undefined,
        },
        {
          label: 'spellingCorrection field present (if interpreted as কাঁদা typo)',
          pass: !!card && (!!card.spellingCorrection || card.word === 'কাদা'),
          detail: card?.spellingCorrection ?? `word: ${card?.word} (may be valid — কাদা means mud)`,
        },
      ];
    },
  },
];

interface LLMResult {
  cards: CardPreview[];
  usage?: TokenUsage;
  error?: string;
  checks: CheckResult[];
  durationMs: number;
}

async function runTestCase(tc: TestCase): Promise<LLMResult> {
  const highlightedWords = parseHighlightedWords(tc.value);
  const cleanText = getCleanText(tc.value);
  const start = Date.now();

  const cards: CardPreview[] = [];
  let usage: TokenUsage | undefined;
  let error: string | undefined;

  try {
    for await (const event of chatApi.stream(
      cleanText,
      undefined,
      highlightedWords.length > 0 ? highlightedWords : undefined
    )) {
      switch (event.type) {
        case 'card_preview':
          cards.push(event.data);
          break;
        case 'usage':
          usage = event.data;
          break;
        case 'error':
          error = event.data;
          break;
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return {
    cards,
    usage,
    error,
    checks: error ? [{ label: 'No errors', pass: false, detail: error }] : tc.checks(cards),
    durationMs: Date.now() - start,
  };
}

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
  const [testResults, setTestResults] = useState<Map<string, LLMResult>>(new Map());
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [runningAll, setRunningAll] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

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

  const runOne = async (tc: TestCase) => {
    setRunningTests((prev) => new Set(prev).add(tc.label));
    try {
      const result = await runTestCase(tc);
      setTestResults((prev) => new Map(prev).set(tc.label, result));
    } finally {
      setRunningTests((prev) => {
        const next = new Set(prev);
        next.delete(tc.label);
        return next;
      });
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    for (const tc of TEST_CASES) {
      await runOne(tc);
    }
    setRunningAll(false);
  };

  const totalChecks = [...testResults.values()].flatMap((r) => r.checks);
  const passCount = totalChecks.filter((c) => c.pass).length;
  const failCount = totalChecks.filter((c) => !c.pass).length;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Prompt Preview</h1>

      {/* Prompt preview section */}
      <div className="space-y-4 mb-10">
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
          {TEST_CASES.map((tc) => (
            <Button key={tc.label} variant="outline" size="sm" onClick={() => setInput(tc.value)}>
              {tc.label}
            </Button>
          ))}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}

        {result && (
          <div className="space-y-4">
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
          </div>
        )}
      </div>

      {/* LLM test runner section */}
      <div className="border-t border-border pt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">LLM Test Runner</h2>
          <div className="flex items-center gap-3">
            {testResults.size > 0 && (
              <span className="text-sm text-muted-foreground">
                <span className="text-green-600 font-medium">{passCount} passed</span>
                {failCount > 0 && (
                  <>
                    {' / '}
                    <span className="text-red-600 font-medium">{failCount} failed</span>
                  </>
                )}
              </span>
            )}
            <Button onClick={runAll} disabled={runningAll || runningTests.size > 0} size="sm">
              {runningAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run All
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {TEST_CASES.map((tc) => {
            const isRunning = runningTests.has(tc.label);
            const result = testResults.get(tc.label);

            return (
              <TestCaseCard
                key={tc.label}
                testCase={tc}
                result={result}
                isRunning={isRunning}
                onRun={() => runOne(tc)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TestCaseCard({
  testCase,
  result,
  isRunning,
  onRun,
}: {
  testCase: TestCase;
  result?: LLMResult;
  isRunning: boolean;
  onRun: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allPass = result && result.checks.every((c) => c.pass);
  const anyFail = result && result.checks.some((c) => !c.pass);

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        result
          ? allPass
            ? 'border-green-500/50'
            : anyFail
              ? 'border-red-500/50'
              : 'border-border'
          : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          {result ? (
            allPass ? (
              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
            ) : (
              <X className="h-4 w-4 text-red-600 flex-shrink-0" />
            )
          ) : (
            <div className="w-4 h-4 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{testCase.label}</span>
              <code className="text-xs text-muted-foreground truncate">{testCase.value}</code>
            </div>
            <p className="text-xs text-muted-foreground">{testCase.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {result && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {(result.durationMs / 1000).toFixed(1)}s
              {result.usage ? ` · ${result.usage.inputTokens + result.usage.outputTokens} tok` : ''}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRun}
            disabled={isRunning}
            className="h-7 text-xs"
          >
            {isRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
          {result && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-7 text-xs"
            >
              {expanded ? '▾' : '▸'}
            </Button>
          )}
        </div>
      </div>

      {result && (
        <div className="px-4 py-2 border-t border-border/50 space-y-1">
          {result.checks.map((check, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {check.pass ? (
                <Check className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <X className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <span className={check.pass ? 'text-muted-foreground' : 'text-red-600'}>
                {check.label}
              </span>
              {check.detail && !check.pass && (
                <span className="text-muted-foreground ml-1 truncate">— {check.detail}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {result && expanded && (
        <div className="px-4 py-3 border-t border-border/50 bg-muted/20">
          <h4 className="text-xs font-medium mb-2 text-muted-foreground">Raw response</h4>
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(result.cards, null, 2)}
          </pre>
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
