import { useSessionCards } from '@/hooks/useSessionCards';
import type { PendingCard } from 'shared';
import { useCreateNote, useAnkiStatus } from '@/hooks/useAnki';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Trash2, Check, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { boldWordInSentence } from '@/lib/utils';
import { sessionApi } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

interface SyncAllState {
  active: boolean;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
}

function SyncAllResult({
  state,
  onDismiss,
}: {
  state: SyncAllState;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!state.active && state.total > 0) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.active, state.total, onDismiss]);

  if (state.active) {
    return (
      <span className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Syncing {state.completed}/{state.total}...
      </span>
    );
  }

  if (state.total > 0) {
    return (
      <span className="text-xs font-medium">
        {state.succeeded > 0 && (
          <span className="text-green-600 dark:text-green-400">
            {state.succeeded} synced
          </span>
        )}
        {state.succeeded > 0 && state.failed > 0 && ', '}
        {state.failed > 0 && (
          <span className="text-red-600 dark:text-red-400">{state.failed} failed</span>
        )}
      </span>
    );
  }

  return null;
}

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
  const { cards, pendingQueue, removeCard, removeFromPendingQueue, clearCards } = useSessionCards();
  const { data: ankiConnected } = useAnkiStatus();
  const createNote = useCreateNote();
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncAllState, setSyncAllState] = useState<SyncAllState>({
    active: false,
    total: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
  });

  const dismissSyncResult = useCallback(() => {
    setSyncAllState({ active: false, total: 0, completed: 0, succeeded: 0, failed: 0 });
  }, []);

  const syncSingleCard = async (card: PendingCard): Promise<boolean> => {
    setSyncingIds((prev) => new Set(prev).add(card.id));
    try {
      const noteId = await createNote.mutateAsync({
        deckName: card.deckName,
        modelName: card.modelName,
        fields: {
          Word: card.word,
          Definition: card.definition,
          Example: boldWordInSentence(card.exampleSentence, card.word),
          Translation: card.sentenceTranslation,
        },
        tags: ['auto-generated'],
      });
      await sessionApi.promotePending(card.id, noteId);
      await useSessionCards.getState().fetchState();
      return true;
    } catch (error) {
      console.error('Failed to sync card:', error);
      return false;
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(card.id);
        return next;
      });
    }
  };

  const handleSyncCard = async (card: PendingCard) => {
    if (!ankiConnected) return;
    await syncSingleCard(card);
  };

  const handleSyncAll = async () => {
    if (!ankiConnected || syncAllState.active) return;

    const cardsToSync = [...pendingQueue];
    setSyncAllState({ active: true, total: cardsToSync.length, completed: 0, succeeded: 0, failed: 0 });

    let succeeded = 0;
    let failed = 0;

    for (const card of cardsToSync) {
      const ok = await syncSingleCard(card);
      if (ok) succeeded++;
      else failed++;
      setSyncAllState((prev) => ({
        ...prev,
        completed: prev.completed + 1,
        succeeded,
        failed,
      }));
    }

    setSyncAllState((prev) => ({ ...prev, active: false }));
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

      {(pendingQueue.length > 0 || syncAllState.total > 0) && (
        <div className="px-2 py-2 border-b border-border bg-orange-50 dark:bg-orange-950/20">
          <div className="flex items-center justify-between">
            {syncAllState.active || syncAllState.total > 0 ? (
              <SyncAllResult state={syncAllState} onDismiss={dismissSyncResult} />
            ) : (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                {pendingQueue.length} card{pendingQueue.length > 1 ? 's' : ''} waiting for Anki
              </span>
            )}
            {ankiConnected && pendingQueue.length > 0 && (
              <Button
                size="sm"
                onClick={handleSyncAll}
                disabled={syncAllState.active}
                className="h-7 text-xs"
              >
                {syncAllState.active ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
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
                    In Anki
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
