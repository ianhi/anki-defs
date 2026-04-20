import type { CardPreview as CardPreviewType } from 'shared';
import { CardPreview } from '../CardPreview';
import { Button } from '../ui/Button';
import { Loader2, ArrowLeft } from 'lucide-react';

interface GenerateStepProps {
  cardPreviews: CardPreviewType[];
  selectedCount: number;
  isGenerating: boolean;
  extraTag: string;
  handleAddAll: () => void;
  addingAll: boolean;
  addAllResult: { added: number } | null;
  handleReset: () => void;
  goBack: () => void;
}

export function GenerateStep({
  cardPreviews,
  selectedCount,
  isGenerating,
  extraTag,
  handleAddAll,
  addingAll,
  addAllResult,
  handleReset,
  goBack,
}: GenerateStepProps) {
  const newCount = cardPreviews.filter((p) => !p.alreadyExists).length;
  const extraTags = extraTag
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="p-4 space-y-4">
      {isGenerating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating example sentences ({cardPreviews.length} / {selectedCount})...
        </div>
      )}

      {!isGenerating && cardPreviews.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {cardPreviews.length} card{cardPreviews.length !== 1 ? 's' : ''} ready.
          </p>
          <Button size="sm" onClick={handleAddAll} disabled={addingAll || newCount === 0}>
            {addingAll ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Adding...
              </>
            ) : (
              `Add all new (${newCount})`
            )}
          </Button>
          {addAllResult && (
            <>
              <span className="text-xs text-muted-foreground">{addAllResult.added} added</span>
              <Button variant="outline" size="sm" onClick={handleReset}>
                New image
              </Button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cardPreviews.map((preview, i) => (
          <CardPreview key={`${preview.word}-${i}`} preview={preview} extraTags={extraTags} />
        ))}
      </div>

      {!isGenerating && (
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to image
          </Button>
          <Button variant="outline" onClick={handleReset}>
            New image
          </Button>
        </div>
      )}
    </div>
  );
}
