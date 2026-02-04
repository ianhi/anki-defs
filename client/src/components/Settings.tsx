import { useEffect, useState, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api';
import { useSettingsStore } from '@/hooks/useSettings';
import { useAnkiStatus, useDecks, useModels } from '@/hooks/useAnki';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Label } from './ui/Label';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import type { AIProvider, Settings as SettingsType } from 'shared';
import { Check, X, Loader2 } from 'lucide-react';

export function Settings() {
  const queryClient = useQueryClient();
  const { settings, loadSettings } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: serverSettings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const updateMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: (data) => {
      loadSettings(data);
      setLocalSettings(data);
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const { data: ankiConnected } = useAnkiStatus();
  const { data: decks } = useDecks();
  const { data: models } = useModels();

  useEffect(() => {
    if (serverSettings) {
      loadSettings(serverSettings);
      setLocalSettings(serverSettings);
    }
  }, [serverSettings, loadSettings]);

  const handleChange = (key: keyof SettingsType, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(localSettings);
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
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
      </div>

      {/* Anki Connection Status */}
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
        </Select>
      </div>

      {/* Claude API Key */}
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

      {/* Gemini API Key */}
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

      {/* Save/Reset Buttons */}
      {hasChanges && (
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
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

      {updateMutation.isError && (
        <p className="text-sm text-destructive">Failed to save settings. Please try again.</p>
      )}
    </div>
  );
}
