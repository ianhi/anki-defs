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

interface OnboardingModalProps {
  onComplete: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { settings, loadSettings } = useSettingsStore();
  const { data: decks } = useDecks();
  const [step, setStep] = useState<1 | 2>(1);
  const [provider, setProvider] = useState<AIProvider>(settings.aiProvider);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [deck, setDeck] = useState(settings.defaultDeck);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleNext = () => {
    if (!apiKey.trim()) {
      setError('An API key is required to generate flashcards.');
      return;
    }
    setError('');
    setStep(2);
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
      _insecureStorageConsent: true, // Auto-consent during onboarding
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
      <div className="bg-card rounded-lg shadow-xl w-full max-w-lg border border-border">
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-xl font-semibold">{step === 1 ? 'Welcome' : 'Choose a deck'}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {step === 1
              ? 'Connect an AI provider to start generating vocabulary flashcards.'
              : 'Pick the Anki deck where new cards will be added.'}
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
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
                  <option value="gemini">Gemini (recommended — free tier available)</option>
                  <option value="claude">Claude</option>
                  <option value="openrouter">OpenRouter</option>
                </Select>
              </div>

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
                    <option value="">Default</option>
                    {(provider === 'gemini' ? GEMINI_MODELS : OPENROUTER_MODELS).map((m) => {
                      const p = MODEL_PRICING[m.value];
                      return (
                        <option key={m.value} value={m.value}>
                          {m.label}
                          {p
                            ? p.input === 0
                              ? ' (Free)'
                              : ` ($${p.input.toFixed(2)}/$${p.output.toFixed(2)})`
                            : ''}
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

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          {step === 1 ? (
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
