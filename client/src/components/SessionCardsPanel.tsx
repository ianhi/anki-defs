import { useSessionCards, type PendingCard } from '@/hooks/useSessionCards';
import { useCreateNote, useAnkiStatus } from '@/hooks/useAnki';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Trash2, Check, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useState } from 'react';

function PendingCardItem({
  card,
  onSync,
  onRemove,
  isSyncing,
}: {
  card: PendingCard;
  onSync: () => void;
  onRemove: () => void;
  isSyncing: boolean;
}) {
  return (
    <Card className="relative border-orange-500/30">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{card.word}</CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
              <Clock className="h-3 w-3 mr-1" />
              Pending
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onSync}
              disabled={isSyncing}
              title="Sync to Anki"
            >
              {isSyncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRemove}
              disabled={isSyncing}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <p className="text-sm text-muted-foreground">{card.definition}</p>
      </CardContent>
    </Card>
  );
}

export function SessionCardsPanel() {
  const { cards, pendingQueue, removeCard, removeFromPendingQueue, clearCards, addCard } =
    useSessionCards();
  const { data: ankiConnected } = useAnkiStatus();
  const createNote = useCreateNote();
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const handleSyncCard = async (card: PendingCard) => {
    if (!ankiConnected) return;

    setSyncingIds((prev) => new Set(prev).add(card.id));

    try {
      const noteId = await createNote.mutateAsync({
        deckName: card.deckName,
        modelName: card.modelName,
        fields: {
          Word: card.word,
          Definition: card.definition,
          Example: card.exampleSentence,
          Translation: card.sentenceTranslation,
        },
        tags: ['auto-generated'],
      });

      // Move from pending to synced
      removeFromPendingQueue(card.id);
      addCard(card, noteId);
    } catch (error) {
      console.error('Failed to sync card:', error);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(card.id);
        return next;
      });
    }
  };

  const handleSyncAll = async () => {
    if (!ankiConnected) return;

    for (const card of pendingQueue) {
      await handleSyncCard(card);
    }
  };

  const totalCount = cards.length + pendingQueue.length;

  if (totalCount === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p className="text-sm">No cards created yet this session.</p>
        <p className="text-xs mt-1">Cards you create will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-sm font-medium">
          Cards ({cards.length}
          {pendingQueue.length > 0 && ` + ${pendingQueue.length} pending`})
        </span>
        <Button variant="ghost" size="sm" onClick={clearCards}>
          Clear
        </Button>
      </div>

      {pendingQueue.length > 0 && (
        <div className="px-2 py-2 border-b border-border bg-orange-50 dark:bg-orange-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-orange-600 dark:text-orange-400">
              {pendingQueue.length} card{pendingQueue.length > 1 ? 's' : ''} waiting for Anki
            </span>
            {ankiConnected && (
              <Button variant="outline" size="sm" onClick={handleSyncAll} className="h-7 text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Sync All
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Pending cards first */}
        {pendingQueue.map((card) => (
          <PendingCardItem
            key={card.id}
            card={card}
            onSync={() => handleSyncCard(card)}
            onRemove={() => removeFromPendingQueue(card.id)}
            isSyncing={syncingIds.has(card.id)}
          />
        ))}

        {/* Synced cards */}
        {cards.map((card) => (
          <Card key={card.id} className="relative">
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{card.word}</CardTitle>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    {card.syncedToAnki ? 'In Anki' : 'Added'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeCard(card.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <p className="text-sm text-muted-foreground">{card.definition}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
