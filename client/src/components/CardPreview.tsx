import { useState } from 'react';
import type { CardPreview as CardPreviewType } from 'shared';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useCreateNote } from '@/hooks/useAnki';
import { useSettingsStore } from '@/hooks/useSettings';
import { Check, Plus, Loader2 } from 'lucide-react';

interface CardPreviewProps {
  preview: CardPreviewType;
}

export function CardPreview({ preview }: CardPreviewProps) {
  const [isAdded, setIsAdded] = useState(false);
  const { settings } = useSettingsStore();
  const createNote = useCreateNote();

  const handleAddCard = async () => {
    try {
      await createNote.mutateAsync({
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
    } catch (error) {
      console.error('Failed to create card:', error);
    }
  };

  return (
    <Card className="bg-background">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{preview.word}</CardTitle>
          {preview.alreadyExists && (
            <Badge variant="secondary">Already in deck</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Definition</p>
          <p className="text-sm">{preview.definition}</p>
        </div>
        {preview.exampleSentence && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Example</p>
            <p className="text-sm">{preview.exampleSentence}</p>
            {preview.sentenceTranslation && (
              <p className="text-sm text-muted-foreground italic">{preview.sentenceTranslation}</p>
            )}
          </div>
        )}
      </CardContent>
      {!preview.alreadyExists && (
        <CardFooter className="pt-0">
          <Button
            onClick={handleAddCard}
            disabled={createNote.isPending || isAdded}
            size="sm"
            className="w-full"
          >
            {createNote.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : isAdded ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Added to {settings.defaultDeck}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add to {settings.defaultDeck}
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
