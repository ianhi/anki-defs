import { useState } from 'react';
import { useDecks, useAnkiStatus } from '@/hooks/useAnki';
import { useSettingsStore } from '@/hooks/useSettings';
import { ChevronDown, Database, AlertCircle, Check, X } from 'lucide-react';
import { Button } from './ui/Button';

export function HeaderDeckSelector() {
  const { settings, setDefaultDeck } = useSettingsStore();
  const { data: connected } = useAnkiStatus();
  const { data: decks, isLoading } = useDecks();

  if (!connected) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-red-500 font-medium"
        title="Anki Desktop must be running with AnkiConnect installed. Cards will be queued and synced when Anki is available."
      >
        <AlertCircle className="h-4 w-4" />
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

export function MobileDeckSelector() {
  const [open, setOpen] = useState(false);
  const { settings, setDefaultDeck } = useSettingsStore();
  const { data: connected } = useAnkiStatus();
  const { data: decks, isLoading } = useDecks();

  if (!connected) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        title="Anki Desktop must be running with AnkiConnect installed. Cards will be queued and synced when Anki is available."
      >
        <AlertCircle className="h-4 w-4 text-red-500" />
      </Button>
    );
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Select deck">
        <Database className="h-4 w-4" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-40 bg-card flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-medium">Select Deck</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">Loading decks...</div>
            ) : (
              <ul className="py-2">
                {decks?.map((deck) => (
                  <li key={deck}>
                    <button
                      className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors ${
                        deck === settings.defaultDeck
                          ? 'bg-secondary text-foreground'
                          : 'text-foreground hover:bg-secondary/50'
                      }`}
                      onClick={() => {
                        setDefaultDeck(deck);
                        setOpen(false);
                      }}
                    >
                      <span className="truncate">{deck}</span>
                      {deck === settings.defaultDeck && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
