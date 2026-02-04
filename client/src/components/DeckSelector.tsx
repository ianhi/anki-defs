import { type ChangeEvent } from 'react';
import { useDecks } from '@/hooks/useAnki';
import { useSettingsStore } from '@/hooks/useSettings';
import { Select } from './ui/Select';
import { Label } from './ui/Label';

export function DeckSelector() {
  const { data: decks, isLoading, error } = useDecks();
  const { settings, setDefaultDeck } = useSettingsStore();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Deck</Label>
        <Select disabled>
          <option>Loading decks...</option>
        </Select>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Label>Deck</Label>
        <Select disabled>
          <option>Failed to load decks</option>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="deck-select">Default Deck</Label>
      <Select
        id="deck-select"
        value={settings.defaultDeck}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => setDefaultDeck(e.target.value)}
      >
        {decks?.map((deck) => (
          <option key={deck} value={deck}>
            {deck}
          </option>
        ))}
      </Select>
    </div>
  );
}
