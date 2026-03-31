import { useEffect, useState, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api';
import { useSettingsStore } from '@/hooks/useSettings';
import { useDecks, useModels, useModelFields, useLanguages } from '@/hooks/useAnki';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Label } from './ui/Label';
import { Button } from './ui/Button';
import type { AIProvider, CardType, CustomLanguage, Settings as SettingsType } from 'shared';
import { CARD_DATA_FIELDS, GEMINI_MODELS, OPENROUTER_MODELS, MODEL_PRICING } from 'shared';
import { CLOZE_DATA_FIELDS, MC_CLOZE_DATA_FIELDS } from '@/lib/utils';
import { Loader2, Volume2, X, Plus } from 'lucide-react';
import { KeyringWarning } from './KeyringWarning';
import { useTheme, type Theme } from '@/hooks/useTheme';
import {
  getVoicesForLanguage,
  setVoiceByName,
  getCurrentVoiceName,
  speak,
  hasTTS,
} from '@/lib/tts';

const CUSTOM_LANGUAGE_SENTINEL = '__custom__';

type SettingsTab = 'ai' | 'anki' | 'preferences';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-2">
      <Label>Theme</Label>
      <div className="flex gap-2">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              theme === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-input hover:bg-muted'
            }`}
            onClick={() => setTheme(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const TTS_PREVIEW_TEXT = 'আমি বাজারে যাচ্ছি।';

function TtsVoicePicker() {
  const voices = getVoicesForLanguage('bn');
  const [selectedVoice, setSelectedVoice] = useState(getCurrentVoiceName() ?? '');

  if (voices.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label htmlFor="tts-voice">Text-to-speech voice</Label>
      <div className="flex gap-2 items-center">
        <Select
          id="tts-voice"
          value={selectedVoice}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setVoiceByName(e.target.value);
            setSelectedVoice(e.target.value);
          }}
          className="flex-1"
        >
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.lang})
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => speak(TTS_PREVIEW_TEXT)}
          title="Preview voice"
        >
          <Volume2 className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Preview: &ldquo;{TTS_PREVIEW_TEXT}&rdquo;</p>
    </div>
  );
}

/** Build combined language options from server languages + custom languages */
function buildLanguageOptions(
  languages: Array<{ code: string; name: string; nativeName: string }> | undefined,
  customLanguages: CustomLanguage[]
) {
  const options: Array<{ code: string; label: string }> = [];

  // Server-provided languages
  if (languages) {
    for (const lang of languages) {
      options.push({
        code: lang.code,
        label: lang.nativeName ? `${lang.name} (${lang.nativeName})` : lang.name,
      });
    }
  }

  // User-defined custom languages (not already in server list)
  const serverCodes = new Set(languages?.map((l) => l.code) ?? []);
  for (const cl of customLanguages) {
    if (!serverCodes.has(cl.code)) {
      options.push({ code: cl.code, label: cl.name });
    }
  }

  return options;
}

function LanguageDropdown({
  id,
  value,
  languages,
  customLanguages,
  onChange,
  onCustom,
  className,
}: {
  id?: string;
  value: string;
  languages: Array<{ code: string; name: string; nativeName: string }> | undefined;
  customLanguages: CustomLanguage[];
  onChange: (code: string) => void;
  onCustom: () => void;
  className?: string;
}) {
  const options = buildLanguageOptions(languages, customLanguages);
  return (
    <Select
      id={id}
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === CUSTOM_LANGUAGE_SENTINEL) {
          onCustom();
        } else {
          onChange(e.target.value);
        }
      }}
      className={className}
    >
      <option value="">-- select --</option>
      {options.map((opt) => (
        <option key={opt.code} value={opt.code}>
          {opt.label}
        </option>
      ))}
      <option value={CUSTOM_LANGUAGE_SENTINEL}>Custom...</option>
    </Select>
  );
}

function LanguageSection({
  localSettings,
  languages,
  decks,
  handleChange,
}: {
  localSettings: SettingsType & {
    targetLanguage?: string;
    deckLanguages?: Record<string, string>;
    customLanguages?: CustomLanguage[];
  };
  languages: Array<{ code: string; name: string; nativeName: string }> | undefined;
  decks: string[] | undefined;
  handleChange: (
    key: string,
    value: string | boolean | string[] | Record<string, string> | CustomLanguage[]
  ) => void;
}) {
  const targetLanguage = localSettings.targetLanguage ?? '';
  const deckLanguages = localSettings.deckLanguages ?? {};
  const customLanguages = localSettings.customLanguages ?? [];

  const [showCustomDefault, setShowCustomDefault] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCode, setCustomCode] = useState('');

  // For adding deck overrides
  const [newOverrideDeck, setNewOverrideDeck] = useState('');
  const [showCustomOverride, setShowCustomOverride] = useState<string | null>(null);
  const [overrideCustomName, setOverrideCustomName] = useState('');
  const [overrideCustomCode, setOverrideCustomCode] = useState('');

  const mappedDecks = new Set(Object.keys(deckLanguages));
  const availableDecks = decks?.filter((d) => !mappedDecks.has(d)) ?? [];

  const addCustomLanguage = (name: string, code: string): string => {
    if (!customLanguages.some((cl) => cl.code === code)) {
      handleChange('customLanguages', [...customLanguages, { code, name }]);
    }
    return code;
  };

  const handleDefaultCustomSave = () => {
    if (customName.trim() && customCode.trim()) {
      const code = addCustomLanguage(customName.trim(), customCode.trim());
      handleChange('targetLanguage', code);
      setShowCustomDefault(false);
      setCustomName('');
      setCustomCode('');
    }
  };

  const handleOverrideCustomSave = (deck: string) => {
    if (overrideCustomName.trim() && overrideCustomCode.trim()) {
      const code = addCustomLanguage(overrideCustomName.trim(), overrideCustomCode.trim());
      handleChange('deckLanguages', { ...deckLanguages, [deck]: code });
      setShowCustomOverride(null);
      setOverrideCustomName('');
      setOverrideCustomCode('');
    }
  };

  const addDeckOverride = (deck: string, langCode: string) => {
    handleChange('deckLanguages', { ...deckLanguages, [deck]: langCode });
    setNewOverrideDeck('');
  };

  const removeDeckOverride = (deck: string) => {
    const updated = { ...deckLanguages };
    delete updated[deck];
    handleChange('deckLanguages', updated);
  };

  const languageLabel = (code: string) => {
    const serverLang = languages?.find((l) => l.code === code);
    if (serverLang) {
      return serverLang.nativeName
        ? `${serverLang.name} (${serverLang.nativeName})`
        : serverLang.name;
    }
    const custom = customLanguages.find((cl) => cl.code === code);
    return custom?.name ?? code;
  };

  return (
    <>
      {/* Default Language */}
      <div className="space-y-2">
        <Label htmlFor="default-language">Default Language</Label>
        <LanguageDropdown
          id="default-language"
          value={targetLanguage}
          languages={languages}
          customLanguages={customLanguages}
          onChange={(code) => handleChange('targetLanguage', code)}
          onCustom={() => setShowCustomDefault(true)}
        />
        {showCustomDefault && (
          <div className="space-y-2 rounded-md border border-input p-3">
            <div className="flex gap-2">
              <Input
                placeholder="Language name"
                value={customName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomName(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Code (e.g. hi)"
                value={customCode}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomCode(e.target.value)}
                className="w-28"
              />
            </div>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Custom languages use generic prompts without language-specific rules.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleDefaultCustomSave}
                disabled={!customName.trim() || !customCode.trim()}
              >
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCustomDefault(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Deck Language Overrides */}
      <div className="space-y-2">
        <Label>Deck language overrides</Label>
        <p className="text-xs text-muted-foreground">
          Subdecks inherit their parent deck&apos;s language.
        </p>

        {/* Existing overrides */}
        {Object.entries(deckLanguages).map(([deck, langCode]) => (
          <div key={deck} className="flex items-center gap-2">
            <span className="text-sm truncate flex-shrink min-w-0" title={deck}>
              {deck}
            </span>
            <span className="text-muted-foreground text-sm flex-shrink-0">&rarr;</span>
            <span className="text-sm flex-shrink-0">{languageLabel(langCode)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => removeDeckOverride(deck)}
              title="Remove override"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {/* Custom language inline form for override */}
        {showCustomOverride && (
          <div className="space-y-2 rounded-md border border-input p-3">
            <p className="text-xs font-medium">
              Custom language for &ldquo;{showCustomOverride}&rdquo;
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Language name"
                value={overrideCustomName}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setOverrideCustomName(e.target.value)
                }
                className="flex-1"
              />
              <Input
                placeholder="Code (e.g. hi)"
                value={overrideCustomCode}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setOverrideCustomCode(e.target.value)
                }
                className="w-28"
              />
            </div>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Custom languages use generic prompts without language-specific rules.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleOverrideCustomSave(showCustomOverride)}
                disabled={!overrideCustomName.trim() || !overrideCustomCode.trim()}
              >
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCustomOverride(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Add new override row */}
        {availableDecks.length > 0 && !showCustomOverride && (
          <div className="flex items-center gap-2">
            <Select
              value={newOverrideDeck}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewOverrideDeck(e.target.value)}
              className="flex-1"
            >
              <option value="">Select deck...</option>
              {availableDecks.map((deck) => (
                <option key={deck} value={deck}>
                  {deck}
                </option>
              ))}
            </Select>
            {newOverrideDeck && (
              <>
                <span className="text-muted-foreground text-sm flex-shrink-0">&rarr;</span>
                <LanguageDropdown
                  value=""
                  languages={languages}
                  customLanguages={customLanguages}
                  onChange={(code) => addDeckOverride(newOverrideDeck, code)}
                  onCustom={() => {
                    setShowCustomOverride(newOverrideDeck);
                    setOverrideCustomName('');
                    setOverrideCustomCode('');
                  }}
                  className="flex-1"
                />
              </>
            )}
            {!newOverrideDeck && (
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0"
                onClick={() => {
                  if (availableDecks.length > 0) setNewOverrideDeck(availableDecks[0] ?? '');
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'ai', label: 'AI Provider' },
  { id: 'anki', label: 'Anki' },
  { id: 'preferences', label: 'Preferences' },
];

export function Settings() {
  const queryClient = useQueryClient();
  const { settings, loadSettings } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [keyringAvailable, setKeyringAvailable] = useState(true);
  const [showInsecureWarning, setShowInsecureWarning] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');

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
      if (error.message.includes('plain text') || error.message.includes('insecure')) {
        setShowInsecureWarning(true);
      }
    },
  });

  const { data: decks } = useDecks();
  const { data: languages } = useLanguages();
  const { data: models } = useModels();
  const { data: modelFields } = useModelFields(localSettings.defaultModel);
  const { data: clozeFields } = useModelFields(localSettings.clozeNoteType || undefined);
  const { data: mcClozeFields } = useModelFields(localSettings.mcClozeNoteType || undefined);

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
    key: string,
    value: string | boolean | string[] | Record<string, string> | CustomLanguage[]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }) as SettingsType);
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab bar */}
      <div className="flex border-b border-border flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — scrollable */}
      <div className="p-4 space-y-5 overflow-y-auto flex-1 min-h-0">
        {activeTab === 'ai' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="ai-provider">Provider</Label>
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

            {localSettings.aiProvider === 'claude' && (
              <div className="space-y-2">
                <Label htmlFor="claude-key">API Key</Label>
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

            {localSettings.aiProvider === 'gemini' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="gemini-key">API Key</Label>
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
                  <Label htmlFor="gemini-model">Model</Label>
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

            {localSettings.aiProvider === 'openrouter' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="openrouter-key">API Key</Label>
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
                  <Label htmlFor="openrouter-model">Model</Label>
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

            {!keyringAvailable && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                No system keyring detected — API keys stored in local config file (your user only).
              </p>
            )}
          </>
        )}

        {activeTab === 'anki' && (
          <>
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

            {/* Default Language */}
            <LanguageSection
              localSettings={localSettings}
              languages={languages}
              decks={decks}
              handleChange={handleChange}
            />

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

            {/* Default Card Types */}
            <div className="space-y-2">
              <Label>Default Card Types</Label>
              <div className="flex gap-4">
                {(['vocab', 'cloze', 'mcCloze'] as CardType[]).map((type) => (
                  <label key={type} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.defaultCardTypes.includes(type)}
                      onChange={() => {
                        const types = localSettings.defaultCardTypes.includes(type)
                          ? localSettings.defaultCardTypes.filter((t) => t !== type)
                          : [...localSettings.defaultCardTypes, type];
                        handleChange('defaultCardTypes', types);
                      }}
                      className="h-3.5 w-3.5"
                    />
                    {type === 'vocab' ? 'Vocab' : type === 'cloze' ? 'Cloze' : 'MC Cloze'}
                  </label>
                ))}
              </div>
            </div>

            {/* Cloze Note Type */}
            <div className="space-y-2">
              <Label htmlFor="cloze-model">Cloze Note Type</Label>
              <Select
                id="cloze-model"
                value={localSettings.clozeNoteType}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  handleChange('clozeNoteType', e.target.value)
                }
                disabled={!models || models.length === 0}
              >
                <option value="">-- not configured --</option>
                {models?.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
            </div>

            {/* Cloze Field Mapping */}
            {localSettings.clozeNoteType && clozeFields && clozeFields.length > 0 && (
              <div className="space-y-2">
                <Label>Cloze Field Mapping</Label>
                <div className="space-y-1.5">
                  {CLOZE_DATA_FIELDS.map((cardField) => (
                    <div key={cardField} className="flex items-center gap-2">
                      <span className="text-sm w-28 flex-shrink-0">{cardField}</span>
                      <span className="text-muted-foreground text-sm">&rarr;</span>
                      <Select
                        value={localSettings.clozeFieldMapping?.[cardField] || ''}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                          const newMapping = {
                            ...localSettings.clozeFieldMapping,
                            [cardField]: e.target.value,
                          };
                          handleChange('clozeFieldMapping', newMapping);
                        }}
                        className="flex-1"
                      >
                        <option value="">-- not mapped --</option>
                        {clozeFields.map((field) => (
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

            {/* MC Cloze Note Type */}
            <div className="space-y-2">
              <Label htmlFor="mc-cloze-model">MC Cloze Note Type</Label>
              <Select
                id="mc-cloze-model"
                value={localSettings.mcClozeNoteType}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  handleChange('mcClozeNoteType', e.target.value)
                }
                disabled={!models || models.length === 0}
              >
                <option value="">-- not configured --</option>
                {models?.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
            </div>

            {/* MC Cloze Field Mapping */}
            {localSettings.mcClozeNoteType && mcClozeFields && mcClozeFields.length > 0 && (
              <div className="space-y-2">
                <Label>MC Cloze Field Mapping</Label>
                <div className="space-y-1.5">
                  {MC_CLOZE_DATA_FIELDS.map((cardField) => (
                    <div key={cardField} className="flex items-center gap-2">
                      <span className="text-sm w-28 flex-shrink-0">{cardField}</span>
                      <span className="text-muted-foreground text-sm">&rarr;</span>
                      <Select
                        value={localSettings.mcClozeFieldMapping?.[cardField] || ''}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                          const newMapping = {
                            ...localSettings.mcClozeFieldMapping,
                            [cardField]: e.target.value,
                          };
                          handleChange('mcClozeFieldMapping', newMapping);
                        }}
                        className="flex-1"
                      >
                        <option value="">-- not mapped --</option>
                        {mcClozeFields.map((field) => (
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
          </>
        )}

        {activeTab === 'preferences' && (
          <>
            <ThemeSelector />

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
              <Label htmlFor="en-bn-prefix">Translation prefix</Label>
              <Input
                id="en-bn-prefix"
                value={localSettings.translationPrefix}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange('translationPrefix', e.target.value)
                }
                placeholder="bn:"
                className="w-24"
              />
            </div>

            {/* TTS Voice */}
            {hasTTS() && <TtsVoicePicker />}
          </>
        )}
      </div>

      {/* Sticky footer — always visible */}
      <div className="border-t border-border p-4 flex-shrink-0 space-y-3">
        {showInsecureWarning && (
          <KeyringWarning
            onConfirm={() => handleSave(true)}
            onCancel={() => setShowInsecureWarning(false)}
            saving={updateMutation.isPending}
          />
        )}

        {!showInsecureWarning && (
          <div className="flex gap-2">
            <Button onClick={() => handleSave()} disabled={!hasChanges || updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
              Discard changes
            </Button>
          </div>
        )}

        {updateMutation.isError && !showInsecureWarning && (
          <p className="text-sm text-destructive">Failed to save settings. Please try again.</p>
        )}
      </div>
    </div>
  );
}
