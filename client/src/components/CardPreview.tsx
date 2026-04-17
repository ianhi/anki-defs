import { useState, useMemo } from 'react';
import { createLogger } from '@/lib/logger';
import { stripHtml } from '@/lib/utils';
import type React from 'react';
import type { CardPreview as CardPreviewType, CardType, VocabCardTemplates } from 'shared';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useCreateNote, useDeleteNote, useAnkiStatus } from '@/hooks/useAnki';
import { useSettingsStore } from '@/hooks/useSettings';
import { useSessionCards } from '@/hooks/useSessionCards';
import { chatApi } from '@/lib/api';
import {
  Check,
  Plus,
  Loader2,
  X,
  Clock,
  Undo2,
  Pencil,
  RefreshCw,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Volume2,
} from 'lucide-react';
import { speak, hasTTS } from '@/lib/tts';

const log = createLogger('CardPreview');

interface CardPreviewProps {
  preview: CardPreviewType;
  isDismissed?: boolean;
  onDismiss?: () => void;
  assistantMsgId?: string;
  onRetryWithContext?: (assistantMsgId: string, context: string) => void;
  extraTags?: string[];
}

// Highlight **word** markers in the example sentence
function highlightBoldMarkers(sentence: string): React.ReactNode {
  if (!sentence) return sentence;

  const parts = sentence.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\*\*([^*]+)\*\*$/);
        return match ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-500/30 dark:text-yellow-200 px-0.5 rounded"
          >
            {match[1]}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

function ExistingCardContent({ card }: { card: NonNullable<CardPreviewType['existingCard']> }) {
  return (
    <div className="mt-1.5 p-2 rounded bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-xs sm:text-sm space-y-0.5">
      <p>
        <span className="font-semibold">{stripHtml(card.word)}</span>
        <span className="text-muted-foreground"> — </span>
        {stripHtml(card.definition)}
      </p>
      {card.exampleSentence && (
        <p className="text-muted-foreground">{stripHtml(card.exampleSentence)}</p>
      )}
      {card.sentenceTranslation && (
        <p className="text-muted-foreground italic">{stripHtml(card.sentenceTranslation)}</p>
      )}
    </div>
  );
}

export function CardPreview({
  preview,
  isDismissed,
  onDismiss,
  assistantMsgId,
  onRetryWithContext,
  extraTags,
}: CardPreviewProps) {
  // Derive "added" state reactively from session store (survives page refresh)
  const sessionCards = useSessionCards();
  const wordKey = preview.word.toLowerCase().trim();

  const sessionMatch = useMemo(
    () => sessionCards.cards.find((c) => c.word.toLowerCase().trim() === wordKey),
    [sessionCards.cards, wordKey]
  );
  const pendingMatch = useMemo(
    () => sessionCards.pendingQueue.find((c) => c.word.toLowerCase().trim() === wordKey),
    [sessionCards.pendingQueue, wordKey]
  );

  const isAdded = !!sessionMatch;
  const isQueued = !!pendingMatch;
  const addedToDeck = sessionMatch?.deckName ?? pendingMatch?.deckName ?? null;
  const addedNoteId = sessionMatch?.noteId ?? null;
  const pendingQueueId = pendingMatch?.id ?? null;

  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // Editable word and definition
  const [editedWord, setEditedWord] = useState<string | null>(null);
  const [editedDefinition, setEditedDefinition] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRelemmatizing, setIsRelemmatizing] = useState(false);
  const [showRetryInput, setShowRetryInput] = useState(false);
  const [retryContext, setRetryContext] = useState('');
  const [showExisting, setShowExisting] = useState(true);
  const [generatingMC, setGeneratingMC] = useState(false);

  const { settings, resolveDeckLanguage } = useSettingsStore();
  const cardLanguage = resolveDeckLanguage(settings.defaultDeck) ?? settings.targetLanguage;
  const [selectedTypes, setSelectedTypes] = useState<Set<CardType>>(
    () => new Set(settings.defaultCardTypes)
  );
  // Per-card override of vocab template gates (defaults from settings).
  const [vocabTemplates, setVocabTemplates] = useState<VocabCardTemplates>(() => ({
    ...settings.vocabCardTemplates,
  }));

  const toggleType = (type: CardType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleVocabTemplate = (key: keyof VocabCardTemplates) => {
    setVocabTemplates((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const { addCard, addToPendingQueue, removeCard, removeFromPendingQueue, hasWord } = sessionCards;
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
    const cardPreview = { ...preview, word: currentWord, definition: currentDefinition };

    // If Anki is not connected, add to pending queue (model name unknown until server runs)
    if (!ankiConnected) {
      addToPendingQueue(cardPreview, targetDeck, '');
      return;
    }

    if (addError) setAddError(null);

    try {
      let firstNoteId: number | undefined;
      let firstModelName: string | undefined;

      // Vocab card
      if (selectedTypes.has('vocab')) {
        const result = await createNote.mutateAsync({
          deck: targetDeck,
          cardType: 'vocab',
          word: currentWord,
          definition: currentDefinition,
          nativeDefinition: preview.nativeDefinition,
          example: preview.exampleSentence,
          translation: preview.sentenceTranslation,
          vocabTemplates,
          tags: ['auto-generated', ...(extraTags || [])],
        });
        firstNoteId = result.noteId;
        firstModelName = result.modelName;
      }

      // Basic cloze card
      if (selectedTypes.has('cloze')) {
        const result = await createNote.mutateAsync({
          deck: targetDeck,
          cardType: 'cloze',
          word: currentWord,
          definition: currentDefinition,
          nativeDefinition: preview.nativeDefinition,
          example: preview.exampleSentence,
          translation: preview.sentenceTranslation,
          tags: ['auto-generated', ...(extraTags || [])],
        });
        if (!firstNoteId) {
          firstNoteId = result.noteId;
          firstModelName = result.modelName;
        }
      }

      // MC cloze card (needs on-demand AI call for distractors — server handles it)
      if (selectedTypes.has('mcCloze')) {
        setGeneratingMC(true);
        try {
          const result = await createNote.mutateAsync({
            deck: targetDeck,
            cardType: 'mcCloze',
            word: currentWord,
            definition: currentDefinition,
            nativeDefinition: preview.nativeDefinition,
            example: preview.exampleSentence,
            translation: preview.sentenceTranslation,
            tags: ['auto-generated', ...(extraTags || [])],
          });
          if (!firstNoteId) {
            firstNoteId = result.noteId;
            firstModelName = result.modelName;
          }
        } finally {
          setGeneratingMC(false);
        }
      }

      if (firstNoteId) {
        addCard(cardPreview, targetDeck, firstModelName ?? '', firstNoteId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (
        !ankiConnected ||
        message.includes('Could not connect') ||
        message.includes('Request failed')
      ) {
        addToPendingQueue(cardPreview, targetDeck, '');
      } else {
        setAddError(message);
      }
    }
  };

  const handleUndo = async () => {
    if (!addedNoteId || !sessionMatch) return;

    try {
      await deleteNote.mutateAsync(addedNoteId);
      removeCard(sessionMatch.id);
    } catch (error) {
      log.error('Failed to undo card:', error);
    }
  };

  const handleRemoveFromQueue = () => {
    if (!pendingQueueId) return;
    removeFromPendingQueue(pendingQueueId);
  };

  const handleRelemmatize = async () => {
    setIsRelemmatizing(true);
    try {
      const result = await chatApi.relemmatize({
        word: currentWord,
        sentence: preview.exampleSentence || undefined,
      });
      setEditedWord(result.lemma);
      if (result.definition) {
        setEditedDefinition(result.definition);
      }
      setIsEditing(false);
    } catch (error) {
      log.error('Failed to relemmatize:', error);
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
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-lg sm:text-xl">{currentWord}</CardTitle>
                  {hasTTS() && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => speak(currentWord, cardLanguage)}
                      title="Pronounce"
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  )}
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
                </div>
                <span className="text-sm sm:text-base w-full">{currentDefinition}</span>
              </>
            )}
            {preview.spellingCorrection && (
              <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
                {preview.spellingCorrection}
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
      {preview.existingCard && alreadyExists && (
        <div className="px-3 sm:px-6 pt-0 pb-1">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            onClick={() => setShowExisting(!showExisting)}
          >
            {showExisting ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showExisting ? 'Hide' : 'Show'} existing card
          </button>
          {showExisting && <ExistingCardContent card={preview.existingCard} />}
        </div>
      )}
      {preview.nativeDefinition && (
        <div className="px-3 sm:px-6 pt-0 pb-0.5">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left cursor-pointer"
            onClick={() =>
              window.dispatchEvent(
                new globalThis.CustomEvent('setInput', { detail: preview.nativeDefinition })
              )
            }
            title="Use as input"
          >
            {preview.nativeDefinition}
          </button>
        </div>
      )}
      {preview.exampleSentence && (
        <CardContent className="pb-1.5 pt-0 sm:pb-2 px-3 sm:px-6">
          <div className="flex items-start gap-1">
            <button
              type="button"
              className="text-sm sm:text-base text-left cursor-pointer hover:text-primary transition-colors"
              onClick={() =>
                window.dispatchEvent(
                  new globalThis.CustomEvent('setInput', { detail: preview.exampleSentence })
                )
              }
              title="Use sentence as input"
            >
              {highlightBoldMarkers(preview.exampleSentence)}
            </button>
            {hasTTS() && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0 mt-0.5"
                onClick={() => speak(preview.exampleSentence, cardLanguage)}
                title="Listen"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {preview.sentenceTranslation && (
            <p className="text-sm sm:text-base text-muted-foreground">
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
            <div className="flex flex-col gap-1 mr-auto text-xs">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has('vocab')}
                    onChange={() => toggleType('vocab')}
                    className="h-3 w-3"
                  />
                  Vocab
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has('cloze')}
                    onChange={() => toggleType('cloze')}
                    className="h-3 w-3"
                  />
                  Cloze
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has('mcCloze')}
                    onChange={() => toggleType('mcCloze')}
                    className="h-3 w-3"
                  />
                  MC
                  {generatingMC && <Loader2 className="h-3 w-3 animate-spin" />}
                </label>
              </div>
              {selectedTypes.has('vocab') && (
                <div className="flex items-center gap-3 pl-4 text-muted-foreground">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vocabTemplates.recognition}
                      onChange={() => toggleVocabTemplate('recognition')}
                      className="h-3 w-3"
                    />
                    Recognition
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vocabTemplates.production}
                      onChange={() => toggleVocabTemplate('production')}
                      className="h-3 w-3"
                    />
                    Production
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vocabTemplates.listening}
                      onChange={() => toggleVocabTemplate('listening')}
                      className="h-3 w-3"
                    />
                    Listening
                  </label>
                </div>
              )}
            </div>
            <Button
              onClick={handleAddCard}
              disabled={createNote.isPending || generatingMC || selectedTypes.size === 0}
              size="sm"
            >
              {createNote.isPending || generatingMC ? (
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
          </>
        )}
        {addError && (
          <p className="text-xs sm:text-sm text-red-600 dark:text-red-300 w-full">{addError}</p>
        )}
      </CardFooter>
      {!isAdded && !isQueued && onRetryWithContext && assistantMsgId && (
        <div className="px-3 pb-2.5 sm:px-6 sm:pb-3">
          {showRetryInput ? (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={retryContext}
                onChange={(e) => setRetryContext(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && retryContext.trim()) {
                    onRetryWithContext(assistantMsgId, retryContext.trim());
                    setRetryContext('');
                    setShowRetryInput(false);
                  }
                }}
                placeholder="Add context (e.g. 'colloquial for snatching')"
                className="flex-1 text-sm bg-muted border border-input rounded px-2.5 py-1.5 min-w-0"
                autoFocus
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs flex-shrink-0"
                disabled={!retryContext.trim()}
                onClick={() => {
                  if (retryContext.trim()) {
                    onRetryWithContext(assistantMsgId, retryContext.trim());
                    setRetryContext('');
                    setShowRetryInput(false);
                  }
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Re-ask
              </Button>
            </div>
          ) : (
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              onClick={() => setShowRetryInput(true)}
            >
              <MessageSquare className="h-3 w-3" />
              Not right? Add context...
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
