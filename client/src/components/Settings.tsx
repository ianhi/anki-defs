import { useEffect, useState, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, ttsApi } from '@/lib/api';
import { useSettingsStore } from '@/hooks/useSettings';
import { useDecks, useLanguages, useNoteTypeHealth } from '@/hooks/useAnki';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Label } from './ui/Label';
import { Button } from './ui/Button';
import type {
  AIProvider,
  CardType,
  CustomLanguage,
  Settings as SettingsType,
  VocabCardTemplates,
} from 'shared';
import { GEMINI_MODELS, OPENROUTER_MODELS, MODEL_PRICING } from 'shared';
import { Loader2, Volume2, X, Plus, Wrench, CheckCircle, AlertTriangle } from 'lucide-react';
import { KeyringWarning } from './KeyringWarning';
import { LanguageDropdown } from './LanguageDropdown';
import { clearHealthDismissals } from './NoteTypeHealth';
import { CHAT_STORAGE_KEY } from '@/lib/storage-keys';
import { useTheme, type Theme } from '@/hooks/useTheme';
import {
  getVoicesForLanguage,
  setVoiceByName,
  getCurrentVoiceName,
  speak,
  hasTTS,
} from '@/lib/tts';

type SettingsTab = 'ai' | 'anki' | 'preferences' | 'debug';

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

const TTS_PREVIEW_TEXT_BY_PREFIX: Record<string, string> = {
  bn: 'আমি বাজারে যাচ্ছি।',
  es: 'Hola, ¿cómo estás?',
  hi: 'नमस्ते, आप कैसे हैं?',
  ta: 'வணக்கம், எப்படி இருக்கிறீர்கள்?',
  fr: 'Bonjour, comment ça va?',
  de: 'Hallo, wie geht es dir?',
  ja: 'こんにちは、お元気ですか？',
  zh: '你好，你好吗？',
  ar: 'مرحبا، كيف حالك؟',
};

function previewTextFor(lang: string): string {
  const prefix = lang.split('-')[0]?.toLowerCase() ?? '';
  return TTS_PREVIEW_TEXT_BY_PREFIX[prefix] ?? 'Hello, how are you?';
}

function TtsVoicePicker() {
  const { settings, resolveDeckLanguage } = useSettingsStore();
  const activeLang = resolveDeckLanguage(settings.defaultDeck) ?? settings.targetLanguage;
  const voices = getVoicesForLanguage(activeLang);
  const [selectedVoice, setSelectedVoice] = useState(getCurrentVoiceName(activeLang) ?? '');
  const previewText = previewTextFor(activeLang);

  if (voices.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Text-to-speech voice</Label>
        <p className="text-xs text-muted-foreground">
          No installed voice found for <span className="font-medium">{activeLang}</span>. Speech
          will fall back to whatever the OS chooses (often robotic). Install a system voice for this
          language, or set up cloud TTS in a future release.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="tts-voice">Text-to-speech voice ({activeLang})</Label>
      <div className="flex gap-2 items-center">
        <Select
          id="tts-voice"
          value={selectedVoice}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setVoiceByName(activeLang, e.target.value);
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
          onClick={() => speak(previewText, activeLang)}
          title="Preview voice"
        >
          <Volume2 className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Preview: &ldquo;{previewText}&rdquo;</p>
    </div>
  );
}

function NoteTypeRepairButton() {
  const { data, isLoading } = useNoteTypeHealth();
  const [cleared, setCleared] = useState(false);
  const issueCount = data?.issues?.length ?? 0;

  return (
    <div className="space-y-2">
      <Label>Note type health</Label>
      <p className="text-xs text-muted-foreground">
        Check if your Anki note types have the latest templates, fields, and CSS.
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={isLoading}
        onClick={() => {
          clearHealthDismissals();
          setCleared(true);
        }}
      >
        <Wrench className="h-3.5 w-3.5 mr-1.5" />
        {cleared
          ? issueCount > 0
            ? `${issueCount} issue${issueCount > 1 ? 's' : ''} found — close settings to review`
            : 'All note types up to date'
          : 'Check for updates'}
      </Button>
    </div>
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
    ankiTtsLocaleByLanguage?: Record<string, string>;
  };
  languages: Array<{ code: string; name: string; nativeName: string }> | undefined;
  decks: string[] | undefined;
  handleChange: (
    key: string,
    value: string | boolean | string[] | Record<string, string> | CustomLanguage[]
  ) => void;
}) {
  const deckLanguages = localSettings.deckLanguages ?? {};
  const customLanguages = localSettings.customLanguages ?? [];
  const ankiTtsByLang = localSettings.ankiTtsLocaleByLanguage ?? {};

  const usedLangCodes = Array.from(new Set(Object.values(deckLanguages)));

  // For adding per-deck language entries
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
      {/* Deck Languages */}
      <div className="space-y-2">
        <Label>Deck languages</Label>
        <p className="text-xs text-muted-foreground">
          Set a language per deck. Subdecks inherit their parent deck&apos;s language automatically,
          so you only need to set the top-level deck.
        </p>

        {/* Existing overrides — language is editable inline */}
        {Object.entries(deckLanguages).map(([deck, langCode]) => (
          <div key={deck} className="flex items-center gap-2">
            <span className="text-sm truncate flex-shrink min-w-0" title={deck}>
              {deck}
            </span>
            <span className="text-muted-foreground text-sm flex-shrink-0">&rarr;</span>
            <LanguageDropdown
              value={langCode}
              languages={languages}
              customLanguages={customLanguages}
              onChange={(code) => handleChange('deckLanguages', { ...deckLanguages, [deck]: code })}
              onCustom={() => {
                setShowCustomOverride(deck);
                setOverrideCustomName('');
                setOverrideCustomCode('');
              }}
              className="flex-1 min-w-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => removeDeckOverride(deck)}
              title="Remove deck language"
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

      {usedLangCodes.length > 0 && (
        <div className="space-y-2">
          <Label>Anki TTS locale per language</Label>
          <p className="text-xs text-muted-foreground">
            Override the locale Anki passes to its built-in <code>{'{{tts}}'}</code> template tag —
            useful when your installed voices are tagged with a different region than the language
            (e.g. Mexican Spanish content but only <code>es_US</code> voices installed). Leave blank
            to use the language default. Format: <code>es_US</code> (with underscore).
          </p>
          {usedLangCodes.map((code) => (
            <div key={code} className="flex items-center gap-2">
              <span className="text-sm w-32 truncate" title={code}>
                {languageLabel(code)}
              </span>
              <span className="text-muted-foreground text-sm">&rarr;</span>
              <Input
                value={ankiTtsByLang[code] ?? ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const next = { ...ankiTtsByLang };
                  if (e.target.value.trim()) {
                    next[code] = e.target.value.trim();
                  } else {
                    delete next[code];
                  }
                  handleChange('ankiTtsLocaleByLanguage', next);
                }}
                placeholder="(default)"
                className="flex-1"
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Changes apply to newly created cards. Existing note types update on next card creation.
          </p>
        </div>
      )}
    </>
  );
}

type TtsCheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok' }
  | { status: 'error'; error: string };

function TtsSection({
  ttsEnabled,
  geminiKeySet,
  onChange,
}: {
  ttsEnabled: boolean;
  geminiKeySet: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const [check, setCheck] = useState<TtsCheckState>({ status: 'idle' });

  const checkTts = async () => {
    setCheck({ status: 'checking' });
    try {
      const result = await ttsApi.check();
      setCheck(
        result.available
          ? { status: 'ok' }
          : { status: 'error', error: result.error ?? 'Cloud TTS not available' }
      );
    } catch {
      setCheck({ status: 'error', error: 'Failed to reach server' });
    }
  };

  return (
    <div className="space-y-2">
      <Label>Embedded TTS audio</Label>
      <div className="flex items-center justify-between">
        <span className="text-sm">Generate audio when creating cards</span>
        <input
          type="checkbox"
          checked={ttsEnabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const next = e.target.checked;
            onChange(next);
            if (next && check.status === 'idle') void checkTts();
          }}
          className="h-4 w-4 rounded border-input"
        />
      </div>

      {ttsEnabled && !geminiKeySet && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Configure a Gemini API key first (AI Provider tab).
        </p>
      )}

      {ttsEnabled && geminiKeySet && check.status !== 'idle' && (
        <div className="flex items-center gap-2">
          {check.status === 'checking' && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
              Checking Cloud TTS access...
            </p>
          )}
          {check.status === 'ok' && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Cloud TTS available
            </p>
          )}
          {check.status === 'error' && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
              {check.error}
              {check.error.includes('403') && (
                <>
                  {' — '}
                  <a
                    href="https://console.cloud.google.com/apis/library/texttospeech.googleapis.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Enable it in Google Cloud Console
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {ttsEnabled && geminiKeySet && check.status === 'idle' && (
        <Button variant="outline" size="sm" onClick={checkTts}>
          Test TTS access
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Uses Google Cloud Text-to-Speech with your Gemini API key (same GCP project). Generates MP3
        audio (~12 KB per word). Requires the{' '}
        <a
          href="https://console.cloud.google.com/apis/library/texttospeech.googleapis.com"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Cloud Text-to-Speech API
        </a>{' '}
        to be enabled.
      </p>
    </div>
  );
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'ai', label: 'AI Provider' },
  { id: 'anki', label: 'Anki' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'debug', label: 'Debug' },
];

function DebugSection() {
  const { updateSettings } = useSettingsStore();

  const resetOnboarding = async () => {
    await settingsApi.update({ onboardingComplete: false });
    window.location.reload();
  };

  const clearChatHistory = () => {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    window.location.reload();
  };

  const clearDeckLanguages = () => {
    void updateSettings({ deckLanguages: {} });
  };

  const clearAllLocalData = () => {
    if (
      !window.confirm(
        'Clear all local app data (onboarding, chat history, theme)? Settings stored on the server are kept.'
      )
    ) {
      return;
    }
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith('anki-defs-') || k === CHAT_STORAGE_KEY
    );
    for (const k of keys) localStorage.removeItem(k);
    window.location.reload();
  };

  return (
    <>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          Tools for re-testing the new-user flow. These only affect this browser&apos;s local
          storage and the per-deck language mapping — your API keys and other server-side settings
          are untouched.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Reset onboarding</p>
            <p className="text-xs text-muted-foreground">
              Clears the onboarded marker and reloads so the first-run wizard shows again.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={resetOnboarding}>
            Reset
          </Button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Clear chat history</p>
            <p className="text-xs text-muted-foreground">
              Removes locally stored chat messages and drafts.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={clearChatHistory}>
            Clear
          </Button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Forget deck languages</p>
            <p className="text-xs text-muted-foreground">
              Empties the per-deck language mapping so you&apos;ll be re-prompted the next time you
              pick a deck.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={clearDeckLanguages}>
            Clear
          </Button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Clear all local data</p>
            <p className="text-xs text-muted-foreground">
              Onboarding marker, chat history, theme preference. Server-stored settings are kept.
            </p>
          </div>
          <Button size="sm" variant="destructive" onClick={clearAllLocalData}>
            Clear
          </Button>
        </div>
      </div>
    </>
  );
}

export function Settings() {
  const queryClient = useQueryClient();
  const { settings, loadSettings } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [keyringAvailable, setKeyringAvailable] = useState(true);
  const [showInsecureWarning, setShowInsecureWarning] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('anki');

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
    value:
      | string
      | boolean
      | string[]
      | Record<string, string>
      | CustomLanguage[]
      | VocabCardTemplates
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

            {/* Vocab Card Templates */}
            <div className="space-y-2">
              <Label>Vocab card templates</Label>
              <div className="flex flex-col gap-1.5">
                {(
                  [
                    {
                      key: 'recognition',
                      label: 'Recognition',
                      hint: 'see word in target language → recall meaning',
                    },
                    {
                      key: 'production',
                      label: 'Production',
                      hint: 'see English → recall target language',
                    },
                    {
                      key: 'listening',
                      label: 'Listening',
                      hint: 'hear word → recall meaning + spelling',
                    },
                  ] as { key: keyof VocabCardTemplates; label: string; hint: string }[]
                ).map(({ key, label, hint }) => (
                  <label key={key} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.vocabCardTemplates[key]}
                      onChange={() =>
                        handleChange('vocabCardTemplates', {
                          ...localSettings.vocabCardTemplates,
                          [key]: !localSettings.vocabCardTemplates[key],
                        })
                      }
                      className="h-3.5 w-3.5 mt-0.5"
                    />
                    <span className="flex-1">
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground"> — {hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                These are the defaults applied when adding new cards. You can override them per-card
                before adding. Note types are auto-created in Anki on first use.
              </p>
            </div>

            {/* Embedded TTS Audio */}
            <TtsSection
              ttsEnabled={localSettings.ttsEnabled}
              geminiKeySet={!!localSettings.geminiApiKey}
              onChange={(enabled) => handleChange('ttsEnabled', enabled)}
            />

            {/* Note Type Health */}
            <NoteTypeRepairButton />
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

        {activeTab === 'debug' && <DebugSection />}
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
