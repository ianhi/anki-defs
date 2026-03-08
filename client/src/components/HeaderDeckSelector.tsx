import { useState, useRef, useEffect } from 'react';
import { useDecks, useAnkiStatus } from '@/hooks/useAnki';
import { useSettingsStore } from '@/hooks/useSettings';
import { ChevronDown, Database, AlertCircle, Check, X, Search } from 'lucide-react';
import { Button } from './ui/Button';

/** Simple fuzzy match: all characters of query appear in order in target (case-insensitive) */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function HeaderDeckSelector() {
  const { settings, setDefaultDeck } = useSettingsStore();
  const { data: connected } = useAnkiStatus();
  const { data: decks, isLoading } = useDecks();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = decks?.filter((d) => (filter ? fuzzyMatch(filter, d) : true)) ?? [];

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) {
      setFilter('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

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
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={isLoading}
          className="flex items-center gap-1 bg-secondary text-secondary-foreground pr-7 pl-3 py-1.5 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring rounded-md border border-input"
        >
          {isLoading ? 'Loading...' : settings.defaultDeck}
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-72 max-h-80 bg-popover border border-border rounded-md shadow-lg z-50 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false);
                  if (e.key === 'Enter' && filtered.length > 0) {
                    setDefaultDeck(filtered[0]!);
                    setOpen(false);
                  }
                }}
                placeholder="Filter decks..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul className="overflow-y-auto flex-1">
              {filtered.map((deck) => (
                <li key={deck}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between transition-colors ${
                      deck === settings.defaultDeck
                        ? 'bg-secondary text-foreground'
                        : 'hover:bg-secondary/50'
                    }`}
                    onClick={() => {
                      setDefaultDeck(deck);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{deck}</span>
                    {deck === settings.defaultDeck && (
                      <Check className="h-3 w-3 text-primary flex-shrink-0 ml-2" />
                    )}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">No matching decks</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileDeckSelector() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const { settings, setDefaultDeck } = useSettingsStore();
  const { data: connected } = useAnkiStatus();
  const { data: decks, isLoading } = useDecks();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = decks?.filter((d) => (filter ? fuzzyMatch(filter, d) : true)) ?? [];

  useEffect(() => {
    if (open) {
      setFilter('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

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
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter decks..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">Loading decks...</div>
            ) : (
              <ul className="py-2">
                {filtered.map((deck) => (
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
                {filtered.length === 0 && (
                  <li className="px-4 py-3 text-sm text-muted-foreground">No matching decks</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
