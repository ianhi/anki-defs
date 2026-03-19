import { useState, type ChangeEvent } from 'react';
import type { AIProvider, Settings } from 'shared';
import { GEMINI_MODELS, OPENROUTER_MODELS, MODEL_PRICING } from 'shared';
import { settingsApi } from '@/lib/api';
import { useSettingsStore } from '@/hooks/useSettings';
import { useDecks } from '@/hooks/useAnki';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Label } from './ui/Label';
import { Loader2 } from 'lucide-react';

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openrouter: 'google/gemini-2.5-flash',
};

function getDefaultModelLabel(provider: AIProvider): string {
  const modelId = DEFAULT_MODELS[provider];
  if (!modelId) return '';
  const models = provider === 'gemini' ? GEMINI_MODELS : OPENROUTER_MODELS;
  return models.find((m) => m.value === modelId)?.label ?? modelId;
}

/** Estimate cost per 1000 cards for a model (based on ~680 tokens per card avg) */
function estimateCostPer1000(modelId: string): string | null {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) return null;
  if (pricing.input === 0 && pricing.output === 0) return 'Free';
  // Average observed: ~600 input + ~80 output tokens per card
  const costPerCard = (600 * pricing.input + 80 * pricing.output) / 1_000_000;
  const per1000 = costPerCard * 1000;
  if (per1000 < 0.01) return '<$0.01';
  return `~$${per1000.toFixed(2)}`;
}

interface OnboardingModalProps {
  onComplete: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { settings, loadSettings } = useSettingsStore();
  const { data: decks } = useDecks();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [provider, setProvider] = useState<AIProvider>(settings.aiProvider);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [deck, setDeck] = useState(settings.defaultDeck);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const effectiveModel = model || DEFAULT_MODELS[provider] || '';
  const costEstimate = estimateCostPer1000(effectiveModel);

  const handleNext = () => {
    if (step === 1) {
      if (!apiKey.trim()) {
        setError('An API key is required to generate flashcards.');
        return;
      }
      setError('');
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    setError('');

    const keyField =
      provider === 'claude'
        ? 'claudeApiKey'
        : provider === 'gemini'
          ? 'geminiApiKey'
          : 'openRouterApiKey';

    const updates: Partial<Settings> & { _insecureStorageConsent?: boolean } = {
      aiProvider: provider,
      [keyField]: apiKey,
      defaultDeck: deck,
      _insecureStorageConsent: true,
    };

    if (model) {
      if (provider === 'gemini') updates.geminiModel = model;
      else if (provider === 'openrouter') updates.openRouterModel = model;
    }

    try {
      const saved = await settingsApi.update(updates);
      loadSettings(saved);
      localStorage.setItem('anki-defs-onboarded', '1');
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-lg sm:max-w-2xl border border-border flex flex-col min-h-[420px] sm:min-h-[460px]">
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-xl font-semibold">
            {step === 1 ? 'Welcome' : step === 2 ? 'Choose a deck' : 'How it works'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {step === 1 &&
              'This app uses AI to generate Anki flashcards from vocabulary words and sentences. Connect an AI provider to get started.'}
            {step === 2 && 'Pick the Anki deck where new cards will be added.'}
            {step === 3 && 'A few tips to get the most out of the app.'}
          </p>
        </div>

        <div className="px-6 py-4 space-y-4 flex-1">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ob-provider">AI Provider</Label>
                <Select
                  id="ob-provider"
                  value={provider}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    setProvider(e.target.value as AIProvider);
                    setModel('');
                  }}
                >
                  <option value="gemini">Gemini (recommended for South Asian languages)</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="claude">Claude</option>
                </Select>
              </div>

              {/* Free vs paid explanation */}
              {provider === 'gemini' && (
                <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded">
                  <p>
                    <strong>Free tier:</strong> Free but rate-limited (e.g. 2.5 Flash allows ~20
                    requests/day). Your data may be used to improve Google&apos;s models.
                  </p>
                  <p>
                    <strong>Paid tier:</strong> Link a billing account in Google Cloud for higher
                    limits and a guarantee that your data is not used for training.
                    {costEstimate && costEstimate !== 'Free' && (
                      <> Estimated cost: {costEstimate} per 1,000 cards.</>
                    )}
                  </p>
                </div>
              )}
              {provider === 'openrouter' && (
                <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded">
                  <p>
                    OpenRouter aggregates multiple AI providers. Some models are free, others are
                    pay-per-use. Data policies vary by provider.
                    {costEstimate && costEstimate !== 'Free' && (
                      <> Estimated cost with default model: {costEstimate} per 1,000 cards.</>
                    )}
                  </p>
                </div>
              )}
              {provider === 'claude' && (
                <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded">
                  <p>
                    Claude is a paid API. Your data is not used for training. Estimated cost: ~$2.50
                    per 1,000 cards (Sonnet 4).
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ob-key">API Key</Label>
                <Input
                  id="ob-key"
                  type="password"
                  value={apiKey}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
                  placeholder={
                    provider === 'claude'
                      ? 'sk-ant-...'
                      : provider === 'gemini'
                        ? 'AIza...'
                        : 'sk-or-...'
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {provider === 'gemini' && (
                    <>
                      Get a free key at{' '}
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        Google AI Studio
                      </a>
                    </>
                  )}
                  {provider === 'claude' && (
                    <>
                      Get a key at{' '}
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        Anthropic Console
                      </a>
                    </>
                  )}
                  {provider === 'openrouter' && (
                    <>
                      Get a key at{' '}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        OpenRouter
                      </a>
                    </>
                  )}
                </p>
              </div>

              {provider !== 'claude' && (
                <div className="space-y-2">
                  <Label htmlFor="ob-model">Model</Label>
                  <Select
                    id="ob-model"
                    value={model}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setModel(e.target.value)}
                  >
                    <option value="">Default ({getDefaultModelLabel(provider)})</option>
                    {(provider === 'gemini' ? GEMINI_MODELS : OPENROUTER_MODELS).map((m) => {
                      const cost = estimateCostPer1000(m.value);
                      return (
                        <option key={m.value} value={m.value}>
                          {m.label}
                          {cost ? ` (${cost}/1K cards)` : ''}
                        </option>
                      );
                    })}
                  </Select>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label htmlFor="ob-deck">Default Deck</Label>
              <Select
                id="ob-deck"
                value={deck}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setDeck(e.target.value)}
                disabled={!decks || decks.length === 0}
              >
                {decks?.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                )) ?? <option>No decks available</option>}
              </Select>
              <p className="text-xs text-muted-foreground">
                You can change this anytime from the header or in Settings.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Type in your target language</p>
                <p>
                  Enter a word or paste a sentence. The AI generates flashcards with definitions,
                  examples, and translations.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Or type in English</p>
                <p>
                  English input is auto-detected and generates cards in your target language. You
                  can also prefix with <code className="bg-muted px-1 rounded">bn:</code> to force
                  it.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Highlight words in sentences</p>
                <p>When you paste a sentence, select which words you want cards for:</p>
                <ul className="list-disc list-inside ml-1 mt-1 space-y-0.5">
                  <li>Tap the crosshair icon, then tap words (mobile)</li>
                  <li>
                    <kbd className="bg-muted px-1 py-0.5 rounded border border-border text-xs">
                      Ctrl+B
                    </kbd>{' '}
                    /{' '}
                    <kbd className="bg-muted px-1 py-0.5 rounded border border-border text-xs">
                      Cmd+B
                    </kbd>{' '}
                    to bold-select words (desktop)
                  </li>
                  <li>
                    Or wrap manually: <code className="bg-muted px-1 rounded">**word**</code>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((step - 1) as 1 | 2)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleFinish} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Get started'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
