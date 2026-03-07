import { useState } from 'react';
import type React from 'react';
import type { CardPreview as CardPreviewType } from 'shared';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useCreateNote, useDeleteNote, useAnkiStatus } from '@/hooks/useAnki';
import { useSettingsStore } from '@/hooks/useSettings';
import { useSessionCards } from '@/hooks/useSessionCards';
import { boldWordInSentence } from '@/lib/utils';
import { chatApi } from '@/lib/api';
import {
  Check,
  Plus,
  Loader2,
  X,
  AlertTriangle,
  Clock,
  Undo2,
  Pencil,
  RefreshCw,
} from 'lucide-react';

interface CardPreviewProps {
  preview: CardPreviewType;
  isDismissed?: boolean;
  onDismiss?: () => void;
}

// Highlight the word in the example sentence
function highlightWord(sentence: string, word: string): React.ReactNode {
  if (!sentence || !word) return sentence;

  // Try to find the word (case-insensitive, handles Bangla)
  const lowerSentence = sentence.toLowerCase();
  const lowerWord = word.toLowerCase();
  const index = lowerSentence.indexOf(lowerWord);

  if (index === -1) {
    return sentence;
  }

  const before = sentence.slice(0, index);
  const match = sentence.slice(index, index + word.length);
  const after = sentence.slice(index + word.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">{match}</mark>
      {after}
    </>
  );
}

export function CardPreview({ preview, isDismissed, onDismiss }: CardPreviewProps) {
  const [isAdded, setIsAdded] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [isQueued, setIsQueued] = useState(false);
  // Track what deck/model the card was actually added to
  const [addedToDeck, setAddedToDeck] = useState<string | null>(null);
  const [addedNoteId, setAddedNoteId] = useState<number | null>(null);
  const [pendingQueueId, setPendingQueueId] = useState<string | null>(null);
  // Editable word and definition
  const [editedWord, setEditedWord] = useState<string | null>(null);
  const [editedDefinition, setEditedDefinition] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRelemmatizing, setIsRelemmatizing] = useState(false);

  const { settings } = useSettingsStore();
  const { addCard, addToPendingQueue, removeCard, removeFromPendingQueue, hasWord } =
    useSessionCards();
  const { data: ankiConnected } = useAnkiStatus();
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  const currentWord = editedWord ?? preview.word;
  const currentDefinition = editedDefinition ?? preview.definition;

  // Check if word exists in session cards (in addition to Anki check from server)
  const existsInSession = hasWord(currentWord);
  const alreadyExists = preview.alreadyExists || existsInSession;

  if (isDismissed) return null;

  const handleAddCard = async () => {
    // If word exists and user hasn't confirmed, show confirmation
    if (alreadyExists && !confirmDuplicate) {
      setConfirmDuplicate(true);
      return;
    }

    const targetDeck = settings.defaultDeck;
    const targetModel = settings.defaultModel;
    const cardPreview = { ...preview, word: currentWord, definition: currentDefinition };

    // If Anki is not connected, add to pending queue
    if (!ankiConnected) {
      const queueId = addToPendingQueue(cardPreview, targetDeck, targetModel);
      setIsQueued(true);
      setAddedToDeck(targetDeck);
      setPendingQueueId(queueId);
      return;
    }

    try {
      const noteId = await createNote.mutateAsync({
        deckName: targetDeck,
        modelName: targetModel,
        fields: {
          Word: currentWord,
          Definition: currentDefinition,
          Example: boldWordInSentence(
            preview.exampleSentence,
            preview.inflectedForm || currentWord
          ),
          Translation: preview.sentenceTranslation,
        },
        tags: ['auto-generated'],
      });
      setIsAdded(true);
      setAddedToDeck(targetDeck);
      setAddedNoteId(noteId);
      addCard(cardPreview, targetDeck, targetModel, noteId);
    } catch (error) {
      console.error('Failed to create card, adding to queue:', error);
      // If Anki fails, add to pending queue
      const queueId = addToPendingQueue(cardPreview, targetDeck, targetModel);
      setIsQueued(true);
      setAddedToDeck(targetDeck);
      setPendingQueueId(queueId);
    }
  };

  const handleUndo = async () => {
    if (!addedNoteId) return;

    try {
      await deleteNote.mutateAsync(addedNoteId);
      // Find and remove the card from session
      const sessionCards = useSessionCards.getState().cards;
      const cardToRemove = sessionCards.find((c) => c.noteId === addedNoteId);
      if (cardToRemove) {
        removeCard(cardToRemove.id);
      }
      setIsAdded(false);
      setAddedNoteId(null);
      setAddedToDeck(null);
    } catch (error) {
      console.error('Failed to undo card:', error);
    }
  };

  const handleRemoveFromQueue = () => {
    if (!pendingQueueId) return;
    removeFromPendingQueue(pendingQueueId);
    setIsQueued(false);
    setPendingQueueId(null);
    setAddedToDeck(null);
  };

  const handleRelemmatize = async () => {
    setIsRelemmatizing(true);
    try {
      const result = await chatApi.relemmatize({
        word: preview.inflectedForm || currentWord,
        sentence: preview.exampleSentence || undefined,
      });
      setEditedWord(result.lemma);
      if (result.definition) {
        setEditedDefinition(result.definition);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to relemmatize:', error);
    } finally {
      setIsRelemmatizing(false);
    }
  };

  const handleDismiss = () => {
    onDismiss?.();
  };

  return (
    <Card
      className={`bg-background ${alreadyExists ? 'border-yellow-500/50' : 'border-primary/20'}`}
    >
      <CardHeader className="pb-1.5 pt-2.5 sm:pb-2 sm:pt-3 px-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={currentWord}
                  onChange={(e) => setEditedWord(e.target.value)}
                  className="text-base sm:text-lg font-semibold bg-muted border border-input rounded px-2 py-0.5 w-28 sm:w-32"
                  autoFocus
                />
                <span className="text-muted-foreground">—</span>
                <input
                  type="text"
                  value={currentDefinition}
                  onChange={(e) => setEditedDefinition(e.target.value)}
                  className="text-sm sm:text-base bg-muted border border-input rounded px-2 py-0.5 w-36 sm:w-48"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setIsEditing(false)}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleRelemmatize}
                  disabled={isRelemmatizing}
                  title="Ask AI for correct dictionary form"
                >
                  {isRelemmatizing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </>
            ) : (
              <>
                <CardTitle className="text-base sm:text-lg">{currentWord}</CardTitle>
                <span className="text-muted-foreground">—</span>
                <span className="text-sm sm:text-base">{currentDefinition}</span>
                {!isAdded && !isQueued && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setIsEditing(true)}
                    title="Edit word or definition"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
            {preview.lemmaMismatch && !editedWord && (
              <Badge
                variant="outline"
                className="border-blue-500 text-blue-600 dark:text-blue-400 cursor-pointer"
                onClick={() => setIsEditing(true)}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {preview.originalLemma} → {preview.word}
              </Badge>
            )}
            {alreadyExists && (
              <Badge
                variant="outline"
                className="border-yellow-500 text-yellow-600 dark:text-yellow-400"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {existsInSession && !preview.alreadyExists ? 'In session' : 'In deck'}
              </Badge>
            )}

          </div>
          {!isAdded && !isQueued && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      {preview.exampleSentence && (
        <CardContent className="pb-1.5 pt-0 sm:pb-2 px-3 sm:px-6">
          <p className="text-xs sm:text-sm">
            {highlightWord(preview.exampleSentence, preview.inflectedForm || preview.word)}
          </p>
          {preview.sentenceTranslation && (
            <p className="text-xs sm:text-sm text-muted-foreground">
              {preview.sentenceTranslation}
            </p>
          )}
        </CardContent>
      )}
      <CardFooter
        className={`pt-1.5 pb-2.5 sm:pt-2 sm:pb-3 px-3 sm:px-6 gap-2 flex-wrap ${settings.leftHanded ? 'flex-row' : 'flex-row-reverse'} justify-end`}
      >
        {isAdded ? (
          <>
            {addedNoteId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={deleteNote.isPending}
                className="h-6 text-xs"
              >
                {deleteNote.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Undo2 className="h-3 w-3 mr-1" />
                    Undo
                  </>
                )}
              </Button>
            )}
            <Badge variant="default" className="bg-green-600 mr-auto">
              <Check className="h-3 w-3 mr-1" />
              Added to {addedToDeck}
            </Badge>
          </>
        ) : isQueued ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveFromQueue}
              className="h-6 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Remove
            </Button>
            <Badge variant="default" className="bg-orange-600 mr-auto">
              <Clock className="h-3 w-3 mr-1" />
              Queued for {addedToDeck}
            </Badge>
          </>
        ) : confirmDuplicate ? (
          <>
            <Button
              onClick={handleAddCard}
              disabled={createNote.isPending}
              size="sm"
              variant="destructive"
            >
              {createNote.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Yes, add anyway'
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDismiss}>
              No, skip
            </Button>
            <span className="text-sm text-yellow-600 dark:text-yellow-400 mr-auto">
              Add duplicate card?
            </span>
          </>
        ) : (
          <>
            <Button onClick={handleAddCard} disabled={createNote.isPending} size="sm">
              {createNote.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {ankiConnected ? 'Add to Anki' : 'Queue for Anki'}
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDismiss}>
              Skip
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
