import { useEffect, useState, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api';
import { useSettingsStore } from '@/hooks/useSettings';
import { useAnkiStatus, useDecks, useModels, useModelFields } from '@/hooks/useAnki';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Label } from './ui/Label';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import type { AIProvider, Settings as SettingsType } from 'shared';
import { CARD_DATA_FIELDS, GEMINI_MODELS, OPENROUTER_MODELS, MODEL_PRICING } from 'shared';
import { Check, X, Loader2 } from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';

export function Settings() {
  const queryClient = useQueryClient();
  const { settings, loadSettings } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [keyringAvailable, setKeyringAvailable] = useState(true);
  const [showInsecureWarning, setShowInsecureWarning] = useState(false);

  const { data: serverSettings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const updateMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: (data) => {
      if ('_keyringAvailable' in data) {
        setKeyringAvailable(data._keyringAvailable as boolean);
      }
      loadSettings(data);
      // Preserve locally-entered API keys — the server returns masked values
      // which would blank out the input fields
      setLocalSettings((prev) => ({
        ...data,
        claudeApiKey: prev.claudeApiKey,
        geminiApiKey: prev.geminiApiKey,
        openRouterApiKey: prev.openRouterApiKey,
      }));
      setHasChanges(false);
      setShowInsecureWarning(false);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) => {
      // 409 = keyring unavailable, needs consent
      if (error.message.includes('plain text') || error.message.includes('insecure')) {
        setShowInsecureWarning(true);
      }
    },
  });

  const platform = usePlatform();
  const { data: ankiConnected } = useAnkiStatus();
  const { data: decks } = useDecks();
  const { data: models } = useModels();
  const { data: modelFields } = useModelFields(localSettings.defaultModel);

  useEffect(() => {
    if (serverSettings) {
      if ('_keyringAvailable' in serverSettings) {
        setKeyringAvailable(serverSettings._keyringAvailable as boolean);
      }
      loadSettings(serverSettings);
      setLocalSettings(serverSettings);
    }
  }, [serverSettings, loadSettings]);

  const handleChange = (
    key: keyof SettingsType,
    value: string | boolean | Record<string, string>
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = (insecureConsent = false) => {
    const payload = insecureConsent
      ? { ...localSettings, _insecureStorageConsent: true }
      : localSettings;
    updateMutation.mutate(payload as Partial<SettingsType>);
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const showFooter = hasChanges || showInsecureWarning || updateMutation.isError;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-4 space-y-6 overflow-y-auto flex-1 min-h-0">
        {/* Anki Connection Status — only for standalone server (not addon or Android) */}
        {platform.platform === 'web' && (
          <div className="space-y-2">
            <Label>AnkiConnect Status</Label>
            <div className="flex items-center gap-2">
              {ankiConnected ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <>
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <X className="h-3 w-3" />
                    Disconnected
                  </Badge>
                  <span className="text-xs text-muted-foreground">Is Anki running?</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* AI Provider */}
        <div className="space-y-2">
          <Label htmlFor="ai-provider">AI Provider</Label>
          <Select
            id="ai-provider"
            value={localSettings.aiProvider}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              handleChange('aiProvider', e.target.value as AIProvider)
            }
          >
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
            <option value="openrouter">OpenRouter</option>
          </Select>
        </div>

        {/* Claude API Key */}
        {localSettings.aiProvider === 'claude' && (
          <div className="space-y-2">
            <Label htmlFor="claude-key">Claude API Key</Label>
            <Input
              id="claude-key"
              type="password"
              value={localSettings.claudeApiKey}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleChange('claudeApiKey', e.target.value)
              }
              placeholder="sk-ant-..."
            />
          </div>
        )}

        {/* Gemini API Key + Model */}
        {localSettings.aiProvider === 'gemini' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="gemini-key">Gemini API Key</Label>
              <Input
                id="gemini-key"
                type="password"
                value={localSettings.geminiApiKey}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange('geminiApiKey', e.target.value)
                }
                placeholder="AI..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gemini-model">Gemini Model</Label>
              <Select
                id="gemini-model"
                value={localSettings.geminiModel}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  handleChange('geminiModel', e.target.value)
                }
              >
                {GEMINI_MODELS.map((m) => {
                  const p = MODEL_PRICING[m.value];
                  return (
                    <option key={m.value} value={m.value}>
                      {m.label}
                      {p ? ` ($${p.input.toFixed(2)}/$${p.output.toFixed(2)})` : ''}
                    </option>
                  );
                })}
              </Select>
            </div>
          </>
        )}

        {/* OpenRouter API Key */}
        {localSettings.aiProvider === 'openrouter' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="openrouter-key">OpenRouter API Key</Label>
              <Input
                id="openrouter-key"
                type="password"
                value={localSettings.openRouterApiKey}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange('openRouterApiKey', e.target.value)
                }
                placeholder="sk-or-..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="openrouter-model">OpenRouter Model</Label>
              <Select
                id="openrouter-model"
                value={localSettings.openRouterModel}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  handleChange('openRouterModel', e.target.value)
                }
              >
                {OPENROUTER_MODELS.map((m) => {
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
          </>
        )}

        {/* Transliteration Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="transliteration">Show transliteration</Label>
          <input
            id="transliteration"
            type="checkbox"
            checked={localSettings.showTransliteration}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleChange('showTransliteration', e.target.checked)
            }
            className="h-4 w-4 rounded border-input"
          />
        </div>

        {/* Left-handed Mode */}
        <div className="flex items-center justify-between">
          <Label htmlFor="left-handed">Left-handed mode</Label>
          <input
            id="left-handed"
            type="checkbox"
            checked={localSettings.leftHanded}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleChange('leftHanded', e.target.checked)
            }
            className="h-4 w-4 rounded border-input"
          />
        </div>

        {/* English→Bangla Settings */}
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-detect-english">Auto-detect English input</Label>
          <input
            id="auto-detect-english"
            type="checkbox"
            checked={localSettings.autoDetectEnglish}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleChange('autoDetectEnglish', e.target.checked)
            }
            className="h-4 w-4 rounded border-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="en-bn-prefix">English→Bangla prefix</Label>
          <Input
            id="en-bn-prefix"
            value={localSettings.englishToBanglaPrefix}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleChange('englishToBanglaPrefix', e.target.value)
            }
            placeholder="bn:"
            className="w-24"
          />
        </div>

        {/* Default Deck */}
        <div className="space-y-2">
          <Label htmlFor="default-deck">Default Deck</Label>
          <Select
            id="default-deck"
            value={localSettings.defaultDeck}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              handleChange('defaultDeck', e.target.value)
            }
            disabled={!decks || decks.length === 0}
          >
            {decks?.map((deck) => (
              <option key={deck} value={deck}>
                {deck}
              </option>
            )) ?? <option>No decks available</option>}
          </Select>
        </div>

        {/* Default Model */}
        <div className="space-y-2">
          <Label htmlFor="default-model">Default Note Type</Label>
          <Select
            id="default-model"
            value={localSettings.defaultModel}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              handleChange('defaultModel', e.target.value)
            }
            disabled={!models || models.length === 0}
          >
            {models?.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            )) ?? <option>No models available</option>}
          </Select>
        </div>

        {/* Field Mapping */}
        {modelFields && modelFields.length > 0 && (
          <div className="space-y-2">
            <Label>Field Mapping</Label>
            <p className="text-xs text-muted-foreground">Map card data to note type fields</p>
            <div className="space-y-1.5">
              {CARD_DATA_FIELDS.map((cardField) => (
                <div key={cardField} className="flex items-center gap-2">
                  <span className="text-sm w-24 flex-shrink-0">{cardField}</span>
                  <span className="text-muted-foreground text-sm">&rarr;</span>
                  <Select
                    value={localSettings.fieldMapping?.[cardField] || ''}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                      const newMapping = {
                        ...localSettings.fieldMapping,
                        [cardField]: e.target.value,
                      };
                      handleChange('fieldMapping', newMapping);
                    }}
                    className="flex-1"
                  >
                    <option value="">-- not mapped --</option>
                    {modelFields.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keyring status indicator */}
        {!keyringAvailable && !showInsecureWarning && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            No system keyring detected — API keys stored in Anki config (local file, your user
            only).
          </p>
        )}
      </div>

      {/* Sticky footer for save/warnings — always visible */}
      {showFooter && (
        <div className="border-t border-border p-4 flex-shrink-0 space-y-3">
          {/* Insecure storage warning */}
          {showInsecureWarning && (
            <div className="p-3 rounded border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950 space-y-2">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Store API key in Anki config?
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                No system keyring (GNOME Keyring, macOS Keychain) was detected, so your API key will
                be saved in Anki&apos;s addon config file. The file is only readable by your OS user
                account, so this is safe for personal machines. Avoid this on shared computers.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSave(true)}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'OK, save'
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowInsecureWarning(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Save/Reset Buttons */}
          {hasChanges && !showInsecureWarning && (
            <div className="flex gap-2">
              <Button onClick={() => handleSave()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </div>
          )}

          {updateMutation.isError && !showInsecureWarning && (
            <p className="text-sm text-destructive">Failed to save settings. Please try again.</p>
          )}
        </div>
      )}
    </div>
  );
}
