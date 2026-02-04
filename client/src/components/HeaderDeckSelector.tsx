import { useDecks, useAnkiStatus } from '@/hooks/useAnki';
import { useSettingsStore } from '@/hooks/useSettings';
import { ChevronDown, Database, AlertCircle } from 'lucide-react';

export function HeaderDeckSelector() {
  const { settings, setDefaultDeck } = useSettingsStore();
  const { data: connected } = useAnkiStatus();
  const { data: decks, isLoading } = useDecks();

  if (!connected) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <span>Anki not connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Database className="h-4 w-4 text-muted-foreground" />
      <div className="relative">
        <select
          value={settings.defaultDeck}
          onChange={(e) => setDefaultDeck(e.target.value)}
          disabled={isLoading}
          className="appearance-none bg-secondary text-secondary-foreground pr-7 pl-3 py-1.5 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring rounded-md border border-input"
        >
          {isLoading ? (
            <option>Loading...</option>
          ) : (
            decks?.map((deck) => (
              <option key={deck} value={deck}>
                {deck}
              </option>
            ))
          )}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}
