import React, { useState } from 'react';
import type { CardPreview as CardPreviewType } from 'shared';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useCreateNote } from '@/hooks/useAnki';
import { useSettingsStore } from '@/hooks/useSettings';
import { useSessionCards } from '@/hooks/useSessionCards';
import { Check, Plus, Loader2, X, AlertTriangle } from 'lucide-react';

interface CardPreviewProps {
  preview: CardPreviewType;
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
    // Word not found directly, return as-is
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

export function CardPreview({ preview, onDismiss }: CardPreviewProps) {
  const [isAdded, setIsAdded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const { settings } = useSettingsStore();
  const { addCard } = useSessionCards();
  const createNote = useCreateNote();

  if (isDismissed) {
    return null;
  }

  const handleAddCard = async () => {
    // If word exists and user hasn't confirmed, show confirmation
    if (preview.alreadyExists && !confirmDuplicate) {
      setConfirmDuplicate(true);
      return;
    }

    try {
      const noteId = await createNote.mutateAsync({
        deckName: settings.defaultDeck,
        modelName: settings.defaultModel,
        fields: {
          Word: preview.word,
          Definition: preview.definition,
          Example: preview.exampleSentence,
          Translation: preview.sentenceTranslation,
        },
        tags: ['auto-generated'],
      });
      setIsAdded(true);
      addCard({
        ...preview,
        id: String(noteId),
        createdAt: Date.now(),
        noteId,
      });
    } catch (error) {
      console.error('Failed to create card:', error);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <Card
      className={`bg-background ${preview.alreadyExists ? 'border-yellow-500/50' : 'border-primary/20'}`}
    >
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-lg">{preview.word}</CardTitle>
            <span className="text-muted-foreground">—</span>
            <span className="text-base">{preview.definition}</span>
            {preview.alreadyExists && (
              <Badge
                variant="outline"
                className="border-yellow-500 text-yellow-600 dark:text-yellow-400"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                In deck
              </Badge>
            )}
          </div>
          {!isAdded && (
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
        <CardContent className="pb-2 pt-0">
          <p className="text-sm">{highlightWord(preview.exampleSentence, preview.word)}</p>
          {preview.sentenceTranslation && (
            <p className="text-sm text-muted-foreground">{preview.sentenceTranslation}</p>
          )}
        </CardContent>
      )}
      <CardFooter className="pt-2 pb-3 gap-2 flex-wrap">
        {isAdded ? (
          <Badge variant="default" className="bg-green-600">
            <Check className="h-3 w-3 mr-1" />
            Added to {settings.defaultDeck}
          </Badge>
        ) : confirmDuplicate ? (
          <>
            <span className="text-sm text-yellow-600 dark:text-yellow-400 mr-2">
              Add duplicate card?
            </span>
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
                  Add to Anki
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
