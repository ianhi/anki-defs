import { useState, useRef, useEffect, useMemo, type RefObject } from 'react';
import { useDecks, useAnkiStatus } from '@/hooks/useAnki';
import { useSettingsStore } from '@/hooks/useSettings';
import { ChevronDown, Database, AlertCircle, Check, X, Search } from 'lucide-react';
import { Button } from './ui/Button';
import { DeckLanguagePrompt } from './DeckLanguagePrompt';

/** Fuzzy match: substring match OR all characters appear in order (case-insensitive).
 *  Also matches against individual `::` segments so "imm" matches "Spanish::immersion". */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  // Substring match on full name or any segment
  if (t.includes(q)) return true;
  if (target.includes('::') && target.split('::').some((seg) => seg.toLowerCase().includes(q)))
    return true;
  // Sequential character match
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/** Shared deck list with search filter — used by both desktop dropdown and mobile overlay */
function DeckList({
  decks,
  selected,
  filter,
  onFilterChange,
  inputRef,
  onSelect,
  onClose,
  itemClass,
}: {
  decks: string[];
  selected: string;
  filter: string;
  onFilterChange: (v: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onSelect: (deck: string) => void;
  onClose: () => void;
  itemClass: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && decks.length > 0) onSelect(decks[0]!);
          }}
          placeholder="Filter decks..."
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
      <ul className="overflow-y-auto flex-1">
        {decks.map((deck) => (
          <li key={deck}>
            <button
              type="button"
              className={`w-full text-left text-sm flex items-center justify-between transition-colors ${itemClass} ${
                deck === selected ? 'bg-secondary text-foreground' : 'hover:bg-secondary/50'
              }`}
              onClick={() => onSelect(deck)}
            >
              <span className="truncate">{deck}</span>
              {deck === selected && <Check className="h-3 w-3 text-primary flex-shrink-0 ml-2" />}
            </button>
          </li>
        ))}
        {decks.length === 0 && (
          <li className={`${itemClass} text-sm text-muted-foreground`}>No matching decks</li>
        )}
      </ul>
    </>
  );
}

export function HeaderDeckSelector() {
  const { settings, setDefaultDeck, setDeckLanguage, resolveDeckLanguage } = useSettingsStore();
  const { data: connected } = useAnkiStatus();
  const { data: decks, isLoading, refetch } = useDecks();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [pendingLanguageDeck, setPendingLanguageDeck] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDeckSelect = (deck: string) => {
    setDefaultDeck(deck);
    setOpen(false);
    setPendingLanguageDeck(resolveDeckLanguage(deck) ? null : deck);
  };

  const filtered = useMemo(
    () => decks?.filter((d) => (filter ? fuzzyMatch(filter, d) : true)) ?? [],
    [decks, filter]
  );

  useEffect(() => {
    if (open) {
      setFilter('');
      setPendingLanguageDeck(null);
      void refetch();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, refetch]);

  // Close on outside click (desktop only)
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
        <span className="hidden sm:inline">Anki not connected</span>
      </div>
    );
  }

  // On mobile, show just the last segment of hierarchical decks (after ::)
  const displayDeck = isLoading ? 'Loading...' : settings.defaultDeck;
  const shortDeck = displayDeck.includes('::') ? displayDeck.split('::').pop()! : displayDeck;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Database className="h-4 w-4 text-muted-foreground hidden sm:block flex-shrink-0" />
      <div className="relative min-w-0" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={isLoading}
          className="flex items-center gap-1 bg-secondary text-secondary-foreground pr-7 pl-2 sm:pl-3 py-1 sm:py-1.5 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring rounded-md border border-input min-w-0"
        >
          <span className="truncate block sm:hidden">{shortDeck}</span>
          <span className="truncate hidden sm:block">{displayDeck}</span>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </button>

        {/* Desktop: dropdown */}
        {open && (
          <div className="hidden sm:flex absolute top-full left-0 mt-1 w-72 max-h-80 bg-popover border border-border rounded-md shadow-lg z-50 flex-col overflow-hidden">
            <DeckList
              decks={filtered}
              selected={settings.defaultDeck}
              filter={filter}
              onFilterChange={setFilter}
              inputRef={inputRef}
              onSelect={handleDeckSelect}
              onClose={() => setOpen(false)}
              itemClass="px-3 py-1.5"
            />
          </div>
        )}

        {pendingLanguageDeck && (
          <DeckLanguagePrompt
            deck={pendingLanguageDeck}
            initialLanguage={settings.targetLanguage}
            onConfirm={(lang) => {
              setDeckLanguage(pendingLanguageDeck, lang);
              setPendingLanguageDeck(null);
            }}
            onCancel={() => setPendingLanguageDeck(null)}
          />
        )}

        {/* Mobile: full-screen overlay */}
        {open && (
          <div className="sm:hidden fixed inset-0 z-40 bg-card flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="font-medium">Select Deck</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <DeckList
              decks={filtered}
              selected={settings.defaultDeck}
              filter={filter}
              onFilterChange={setFilter}
              inputRef={inputRef}
              onSelect={handleDeckSelect}
              onClose={() => setOpen(false)}
              itemClass="px-4 py-3"
            />
          </div>
        )}
      </div>
    </div>
  );
}
