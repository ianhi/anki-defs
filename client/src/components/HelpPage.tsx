import { Button } from './ui/Button';
import { X } from 'lucide-react';

interface HelpPageProps {
  onClose: () => void;
}

export function HelpPage({ onClose }: HelpPageProps) {
  return (
    <div className="fixed inset-0 z-50 bg-card overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">How to use</h1>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-8 text-sm">
          {/* What this app does */}
          <section>
            <h2 className="text-base font-medium mb-2">What is this?</h2>
            <p className="text-muted-foreground">
              This app generates Anki flashcards from vocabulary words using AI. Type a word or
              paste a sentence, and it creates cards with definitions, example sentences, and
              translations — ready to add to your Anki deck.
            </p>
          </section>

          {/* Basic usage */}
          <section>
            <h2 className="text-base font-medium mb-2">Basic usage</h2>
            <div className="space-y-3 text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Single word</p>
                <p>
                  Type a word and press send. The AI generates a card with definition, Bangla
                  meaning, example sentence, and translation.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Sentence with highlighted words</p>
                <p>
                  Paste a sentence and highlight the words you want cards for. The AI uses the
                  sentence as context to produce more accurate definitions.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">English to target language</p>
                <p>
                  Type in English and the AI generates cards in your target language. English input
                  is auto-detected, or you can prefix with{' '}
                  <code className="bg-muted px-1 rounded">bn:</code> to force it.
                </p>
              </div>
            </div>
          </section>

          {/* How to highlight words */}
          <section>
            <h2 className="text-base font-medium mb-2">Highlighting words</h2>
            <p className="text-muted-foreground mb-3">
              When you paste a sentence, you need to tell the AI which words you want cards for.
              There are three ways to highlight:
            </p>
            <div className="space-y-2 text-muted-foreground">
              <div className="flex gap-3 items-start">
                <span className="bg-muted text-foreground px-2 py-0.5 rounded text-xs font-mono flex-shrink-0">
                  Mobile
                </span>
                <p>
                  Place your cursor on a word in the input, then tap it in the Focus bar above to
                  highlight it.
                </p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="bg-muted text-foreground px-2 py-0.5 rounded text-xs font-mono flex-shrink-0">
                  Keyboard
                </span>
                <p>
                  Select text and press{' '}
                  <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border text-xs">
                    Ctrl+B
                  </kbd>{' '}
                  (or{' '}
                  <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border text-xs">
                    Cmd+B
                  </kbd>{' '}
                  on Mac) to wrap words in bold markers.
                </p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="bg-muted text-foreground px-2 py-0.5 rounded text-xs font-mono flex-shrink-0">
                  Manual
                </span>
                <p>
                  Wrap words in double asterisks:{' '}
                  <code className="bg-muted px-1 rounded">**word**</code>
                </p>
              </div>
            </div>
          </section>

          {/* Cards */}
          <section>
            <h2 className="text-base font-medium mb-2">Working with cards</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>
                Each generated card shows a preview with the word, definition, example sentence, and
                translation. You can:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>Edit the word or definition before adding</li>
                <li>Ask the AI to re-check the dictionary form (lemmatize)</li>
                <li>Add context and re-generate if the definition is wrong</li>
                <li>Add to Anki immediately, or queue for later if Anki is offline</li>
                <li>Undo (delete from Anki) if you change your mind</li>
              </ul>
            </div>
          </section>

          {/* Note types */}
          <section>
            <h2 className="text-base font-medium mb-2">Anki note types</h2>
            <p className="text-muted-foreground">
              Cards are created using the note type set in Settings &gt; Anki &gt; Default Note
              Type. The field mapping tells the app which fields in your note type correspond to
              Word, Definition, Example, etc. If your note type has different field names, configure
              the mapping in Settings.
            </p>
          </section>

          {/* AI providers */}
          <section>
            <h2 className="text-base font-medium mb-2">AI providers</h2>
            <div className="space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">Gemini</strong> — Recommended for South Asian
                languages. Free tier available with rate limits. Paid tier is very affordable
                (~$0.14 per 1,000 cards).
              </p>
              <p>
                <strong className="text-foreground">OpenRouter</strong> — Aggregates multiple AI
                providers including free models. Good for experimentation.
              </p>
              <p>
                <strong className="text-foreground">Claude</strong> — High quality but more
                expensive (~$2.50 per 1,000 cards). Your data is never used for training.
              </p>
            </div>
          </section>

          {/* Troubleshooting */}
          <section>
            <h2 className="text-base font-medium mb-2">Troubleshooting</h2>
            <div className="space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">API key not configured</strong> — Go to Settings
                &gt; AI Provider and enter your key.
              </p>
              <p>
                <strong className="text-foreground">Anki not connected</strong> — Make sure Anki
                Desktop is running with the AnkiConnect addon installed. Cards will queue and sync
                when Anki becomes available.
              </p>
              <p>
                <strong className="text-foreground">Wrong note type</strong> — Check Settings &gt;
                Anki &gt; Default Note Type and Field Mapping.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
