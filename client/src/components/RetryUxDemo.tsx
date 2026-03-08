import type { ReactNode } from 'react';
import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { RefreshCw, ChevronDown, ChevronUp, Pencil, Plus, Send, ArrowLeft } from 'lucide-react';

// Mock data for all options
const MOCK_WORD = 'হাইজানো';
const MOCK_AI_WORD = 'হারানো';
const MOCK_DEFINITION = 'to lose, to misplace';
const MOCK_EXAMPLE = 'আমি আমার চাবি হারিয়ে ফেলেছি।';
const MOCK_TRANSLATION = 'I have lost my keys.';

function MockCardPreview({ children }: { children?: ReactNode }) {
  return (
    <Card className="bg-background border-primary/20">
      <CardHeader className="pb-1.5 pt-2.5 px-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <CardTitle className="text-base">{MOCK_AI_WORD}</CardTitle>
          <span className="text-muted-foreground">—</span>
          <span className="text-sm">{MOCK_DEFINITION}</span>
          <Badge
            variant="outline"
            className="border-orange-500 text-orange-600 dark:text-orange-400"
          >
            Wrong word?
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-1.5 pt-0 px-3">
        <p className="text-xs">{MOCK_EXAMPLE}</p>
        <p className="text-xs text-muted-foreground">{MOCK_TRANSLATION}</p>
      </CardContent>
      {children && (
        <CardFooter className="pt-1.5 pb-2.5 px-3 flex-col items-stretch gap-2">
          {children}
        </CardFooter>
      )}
      {!children && (
        <CardFooter className="pt-1.5 pb-2.5 px-3 gap-2 flex-row-reverse justify-end">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add to Anki
          </Button>
          <Button variant="outline" size="sm">
            Skip
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function ComposedQuery({ context }: { context: string }) {
  if (!context) return null;
  return (
    <div className="mt-2 p-2 rounded-md bg-muted text-xs">
      <span className="text-muted-foreground">Query sent to AI: </span>
      <span className="font-medium">
        {MOCK_WORD} — Note: {context}
      </span>
    </div>
  );
}

function OptionA() {
  const [context, setContext] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-3">
      <MockCardPreview>
        <div className="flex gap-2">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add to Anki
          </Button>
          <Button variant="outline" size="sm">
            Skip
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Not right? Add context (e.g. 'colloquial for snatching')"
            value={context}
            onChange={(e) => {
              setContext(e.target.value);
              setSubmitted(false);
            }}
            className="text-xs h-8"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => context && setSubmitted(true)}
            disabled={!context}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Re-ask
          </Button>
        </div>
        {submitted && <ComposedQuery context={context} />}
      </MockCardPreview>
    </div>
  );
}

function OptionB() {
  const [expanded, setExpanded] = useState(false);
  const [context, setContext] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-3">
      {/* AI message bubble */}
      <div className="flex gap-2 items-start">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-medium">AI</span>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start gap-1">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm flex-1">
              <p>
                I found <strong>{MOCK_AI_WORD}</strong> — {MOCK_DEFINITION}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => setExpanded(!expanded)}
              title="Retry with context"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${expanded ? 'text-primary' : ''}`} />
            </Button>
          </div>

          {expanded && (
            <div className="bg-muted/50 border rounded-lg p-3 space-y-2">
              <div className="text-xs text-muted-foreground">
                Original word: <span className="font-medium text-foreground">{MOCK_WORD}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add context for the AI..."
                  value={context}
                  onChange={(e) => {
                    setContext(e.target.value);
                    setSubmitted(false);
                  }}
                  className="text-xs h-8"
                  autoFocus
                />
                <Button size="sm" onClick={() => context && setSubmitted(true)} disabled={!context}>
                  Retry
                </Button>
              </div>
              {submitted && <ComposedQuery context={context} />}
            </div>
          )}

          <MockCardPreview />
        </div>
      </div>
    </div>
  );
}

function OptionC() {
  const [isEditing, setIsEditing] = useState(false);
  const [showContextInput, setShowContextInput] = useState(false);
  const [context, setContext] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-3">
      <Card className="bg-background border-primary/20">
        <CardHeader className="pb-1.5 pt-2.5 px-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isEditing ? (
              <>
                <input
                  type="text"
                  defaultValue={MOCK_AI_WORD}
                  className="text-base font-semibold bg-muted border border-input rounded px-2 py-0.5 w-28"
                />
                <span className="text-muted-foreground">—</span>
                <input
                  type="text"
                  defaultValue={MOCK_DEFINITION}
                  className="text-sm bg-muted border border-input rounded px-2 py-0.5 w-36"
                />
              </>
            ) : (
              <>
                <CardTitle className="text-base">{MOCK_AI_WORD}</CardTitle>
                <span className="text-muted-foreground">—</span>
                <span className="text-sm">{MOCK_DEFINITION}</span>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => {
                setIsEditing(!isEditing);
                if (!isEditing) setShowContextInput(false);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-1.5 pt-0 px-3">
          <p className="text-xs">{MOCK_EXAMPLE}</p>
          <p className="text-xs text-muted-foreground">{MOCK_TRANSLATION}</p>
        </CardContent>
        <CardFooter className="pt-1.5 pb-2.5 px-3 flex-col items-stretch gap-2">
          <div className="flex gap-2 justify-end">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add to Anki
            </Button>
            <Button variant="outline" size="sm">
              Skip
            </Button>
            {isEditing && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowContextInput(!showContextInput)}
                className="mr-auto"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Re-ask AI with context
              </Button>
            )}
          </div>
          {showContextInput && (
            <div className="flex gap-2">
              <Input
                placeholder="e.g. 'colloquial form, means snatching'"
                value={context}
                onChange={(e) => {
                  setContext(e.target.value);
                  setSubmitted(false);
                }}
                className="text-xs h-8"
                autoFocus
              />
              <Button size="sm" onClick={() => context && setSubmitted(true)} disabled={!context}>
                <Send className="h-3 w-3 mr-1" />
                Send
              </Button>
            </div>
          )}
          {submitted && <ComposedQuery context={context} />}
        </CardFooter>
      </Card>
    </div>
  );
}

function OptionD() {
  const [showContext, setShowContext] = useState(false);
  const [context, setContext] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-3">
      {/* Mock input area */}
      <div className="border rounded-lg bg-background p-2 space-y-2">
        <textarea
          defaultValue={MOCK_WORD}
          className="w-full bg-transparent text-sm resize-none focus:outline-none px-1"
          rows={1}
        />
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          onClick={() => setShowContext(!showContext)}
        >
          {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Add context for AI
        </button>
        {showContext && (
          <Input
            placeholder="e.g. 'colloquial Bangla, means to snatch'"
            value={context}
            onChange={(e) => {
              setContext(e.target.value);
              setSubmitted(false);
            }}
            className="text-xs h-8"
            autoFocus
          />
        )}
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              if (context) setSubmitted(true);
            }}
          >
            <Send className="h-3 w-3 mr-1" />
            Send
          </Button>
        </div>
      </div>
      {submitted && <ComposedQuery context={context} />}

      {/* Show what the previous (wrong) result looked like */}
      <div className="text-xs text-muted-foreground">Previous AI result:</div>
      <MockCardPreview />
    </div>
  );
}

export function RetryUxDemo() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            window.location.href = window.location.pathname;
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-lg font-semibold">Retry UX Demo</h1>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        <div className="mb-6 space-y-1">
          <p className="text-sm text-muted-foreground">
            Scenario: User typed <strong className="text-foreground">{MOCK_WORD}</strong>, but the
            AI responded with <strong className="text-foreground">{MOCK_AI_WORD}</strong> (
            {MOCK_DEFINITION}) — wrong word.
          </p>
          <p className="text-sm text-muted-foreground">
            Each option below shows a different way for the user to correct this and re-query.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Option A */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Option A: Inline reply on the card</h2>
              <p className="text-xs text-muted-foreground">
                A text input below the card lets the user add context and re-ask without leaving the
                card.
              </p>
            </div>
            <OptionA />
          </section>

          {/* Option B */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Option B: Retry button on the AI message</h2>
              <p className="text-xs text-muted-foreground">
                A retry icon on the AI message bubble expands to reveal a context input and retry
                action.
              </p>
            </div>
            <OptionB />
          </section>

          {/* Option C */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Option C: Correction on the card + re-ask</h2>
              <p className="text-xs text-muted-foreground">
                Extends the existing edit flow with a &ldquo;Re-ask AI with context&rdquo; button.
                Click the pencil icon first.
              </p>
            </div>
            <OptionC />
          </section>

          {/* Option D */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Option D: Context hint in the input area</h2>
              <p className="text-xs text-muted-foreground">
                The message input has a collapsible &ldquo;Add context for AI&rdquo; section for
                hints.
              </p>
            </div>
            <OptionD />
          </section>
        </div>
      </div>
    </div>
  );
}
