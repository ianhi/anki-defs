import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import type { TokenUsage, VocabPair } from 'shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Loader2,
  ArrowRight,
  Crop as CropIcon,
  Paintbrush,
  RectangleHorizontal,
  Undo2,
  Eraser,
  Scissors,
} from 'lucide-react';

type ActiveTool = 'none' | 'crop' | 'rect' | 'brush';
import { MaskCanvas } from './MaskCanvas';
import { useImageMask, sampleBackgroundColor } from './useImageMask';
import { estimateGenerateCost, formatCost } from '@/lib/photo-utils';
import { generateId, stripHtml } from '@/lib/utils';

interface IdentifiedPair extends VocabPair {
  id: string;
  selected: boolean;
}

interface ExtractStepProps {
  imageUrl: string;
  imageBlob: Blob;
  geminiModel: string;
  extractUsage: TokenUsage | null;
  onExtract: (blob: Blob, instructions: string) => Promise<VocabPair[]>;
  onGenerate: (pairs: VocabPair[]) => void;
  isExtracting: boolean;
  extraTag: string;
  onExtraTagChange: (tag: string) => void;
}

export function ExtractStep({
  imageUrl,
  imageBlob,
  geminiModel,
  extractUsage,
  onExtract,
  onGenerate,
  isExtracting,
  extraTag,
  onExtraTagChange,
}: ExtractStepProps) {
  const [pairs, setPairs] = useState<IdentifiedPair[]>([]);
  const [crop, setCrop] = useState<Crop>();
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const [instructions, setInstructions] = useState('');
  const [devPreviewUrl, setDevPreviewUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const isDev = import.meta.env.DEV;

  const mask = useImageMask();

  // Sample the image's background color for mask painting
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => mask.setMaskColor(sampleBackgroundColor(img));
    img.src = imageUrl;
  }, [imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPairs = useMemo(() => pairs.filter((p) => p.selected && p.word.trim()), [pairs]);
  const selectedCount = selectedPairs.length;
  const duplicateCount = useMemo(() => pairs.filter((p) => p.alreadyExists).length, [pairs]);
  const newCount = pairs.length - duplicateCount;

  const generateCostEstimate = useMemo(
    () => estimateGenerateCost(selectedCount, geminiModel || 'gemini-2.5-flash'),
    [selectedCount, geminiModel]
  );

  const getImageBlob = useCallback(async (): Promise<Blob | null> => {
    const image = imgRef.current;
    if (!image) return imageBlob;

    const needsMask = mask.hasStrokes;
    const hasCrop = crop && crop.width > 0 && crop.height > 0;

    if (!needsMask && !hasCrop) return imageBlob;

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(image, 0, 0);
    mask.bakeMask(ctx, canvas.width, canvas.height);

    if (hasCrop) {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const cx = (crop.unit === '%' ? (crop.x / 100) * image.width : crop.x) * scaleX;
      const cy = (crop.unit === '%' ? (crop.y / 100) * image.height : crop.y) * scaleY;
      const cw = (crop.unit === '%' ? (crop.width / 100) * image.width : crop.width) * scaleX;
      const ch = (crop.unit === '%' ? (crop.height / 100) * image.height : crop.height) * scaleY;

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cw;
      cropCanvas.height = ch;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) return null;
      cropCtx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
      return new Promise<Blob | null>((resolve) => {
        cropCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
      });
    }

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
    });
  }, [crop, imageBlob, mask.bakeMask, mask.hasStrokes]);

  const handleExtract = useCallback(async () => {
    const blob = await getImageBlob();
    if (!blob) return;

    if (isDev) {
      if (devPreviewUrl) URL.revokeObjectURL(devPreviewUrl);
      setDevPreviewUrl(URL.createObjectURL(blob));
    }

    const newPairs = await onExtract(blob, instructions);
    const identified: IdentifiedPair[] = newPairs.map((p) => ({
      ...p,
      id: generateId(),
      selected: !p.alreadyExists,
    }));
    setPairs(identified);
  }, [getImageBlob, onExtract, instructions, isDev, devPreviewUrl]);

  const togglePair = useCallback((id: string) => {
    setPairs((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  }, []);

  const selectAll = useCallback(() => {
    setPairs((prev) => prev.map((p) => ({ ...p, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setPairs((prev) => prev.map((p) => ({ ...p, selected: false })));
  }, []);

  const selectNewOnly = useCallback(() => {
    setPairs((prev) => prev.map((p) => ({ ...p, selected: !p.alreadyExists })));
  }, []);

  const updatePair = useCallback((index: number, field: 'word' | 'definition', value: string) => {
    setPairs((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }, []);

  const handleGenerate = useCallback(() => {
    if (selectedPairs.length === 0) return;
    onGenerate(selectedPairs);
  }, [selectedPairs, onGenerate]);

  return (
    <div className="space-y-3 pb-4">
      {/* Image with crop + mask overlay */}
      <div className="border-b border-border">
        <div className="relative">
          <ReactCrop
            crop={activeTool === 'crop' ? crop : undefined}
            onChange={(c) => setCrop(c)}
            disabled={activeTool !== 'crop'}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Textbook photo"
              className="max-w-full max-h-[50vh] object-contain"
            />
          </ReactCrop>
          <MaskCanvas
            imageRef={imgRef}
            shapes={mask.shapes}
            maskColor={mask.maskColor}
            currentShapeRef={mask.currentShapeRef}
            isDrawingRef={mask.isDrawingRef}
            isMaskMode={activeTool === 'rect' || activeTool === 'brush'}
            onStartStroke={(nx, ny) => {
              mask.setActiveTool(activeTool === 'brush' ? 'brush' : 'rect');
              mask.startStroke(nx, ny);
            }}
            onContinueStroke={mask.continueStroke}
            onEndStroke={mask.endStroke}
          />
        </div>
      </div>

      {/* Controls: mask tools + extract */}
      <div className="px-4 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Tools — click to activate, click active to deactivate */}
          {(
            [
              { tool: 'crop' as ActiveTool, icon: Scissors, label: 'Crop' },
              { tool: 'rect' as ActiveTool, icon: RectangleHorizontal, label: 'Rect' },
              { tool: 'brush' as ActiveTool, icon: Paintbrush, label: 'Brush' },
            ] as const
          ).map(({ tool, icon: Icon, label }) => (
            <Button
              key={tool}
              variant={activeTool === tool ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setActiveTool(activeTool === tool ? 'none' : tool);
                if (tool === 'crop' && activeTool === 'crop') setCrop(undefined);
              }}
            >
              <Icon className="h-3.5 w-3.5 mr-1" />
              {label}
            </Button>
          ))}
          {mask.hasStrokes && (
            <>
              <Button variant="ghost" size="sm" onClick={mask.undo} title="Undo">
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={mask.clearMask} title="Clear masks">
                <Eraser className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {crop && crop.width > 0 && activeTool !== 'crop' && (
            <button
              onClick={() => setCrop(undefined)}
              className="text-xs text-muted-foreground underline"
            >
              clear crop
            </button>
          )}
          <Button size="sm" onClick={handleExtract} disabled={isExtracting} className="ml-auto">
            {isExtracting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <CropIcon className="h-3.5 w-3.5 mr-1.5" />
                Extract{crop && crop.width > 0 ? ' selection' : ''}
              </>
            )}
          </Button>
        </div>

        {/* Usage + dev preview toggle */}
        {(extractUsage || (isDev && devPreviewUrl)) && (
          <div className="flex items-center gap-2">
            {extractUsage && (
              <span className="text-xs text-muted-foreground">
                {extractUsage.inputTokens + extractUsage.outputTokens} tok
                {formatCost(extractUsage) && ` (${formatCost(extractUsage)})`}
              </span>
            )}
            {isDev && devPreviewUrl && (
              <button
                onClick={() => {
                  URL.revokeObjectURL(devPreviewUrl);
                  setDevPreviewUrl(null);
                }}
                className="text-xs text-muted-foreground underline"
              >
                hide preview
              </button>
            )}
          </div>
        )}

        {/* Extra instructions for extraction */}
        <textarea
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            // Auto-grow: reset height then set to scrollHeight
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
          }}
          placeholder="Extra instructions, e.g. 'ignore the middle column', 'only extract verbs'"
          className="w-full text-sm rounded-md border border-border bg-background px-3 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none overflow-y-auto"
          style={{ minHeight: '2rem', maxHeight: '6rem' }}
          rows={1}
        />
      </div>

      {/* Dev: show exact image sent to LLM */}
      {isDev && devPreviewUrl && (
        <div className="px-4 space-y-1">
          <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
            Dev: image sent to LLM
          </p>
          <img
            src={devPreviewUrl}
            alt="Image sent to LLM"
            className="max-w-full max-h-[40vh] border border-yellow-400 rounded"
          />
        </div>
      )}

      {/* Extracted pairs with selection */}
      {pairs.length > 0 && (
        <div className="px-4 space-y-3 max-w-md">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {pairs.length} word{pairs.length !== 1 ? 's' : ''}
                {duplicateCount > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400">
                    {' '}
                    ({duplicateCount} already in deck)
                  </span>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setPairs([])}
              >
                Clear all
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={selectAll}
                className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
              >
                Select all
              </button>
              <button
                onClick={deselectAll}
                className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
              >
                Deselect all
              </button>
              {duplicateCount > 0 && newCount > 0 && (
                <button
                  onClick={selectNewOnly}
                  className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
                >
                  New only
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            {pairs.map((pair, i) => (
              <div
                key={pair.id}
                className={`rounded-md px-1 py-0.5 transition-colors ${
                  pair.selected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800'
                    : 'opacity-40'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={pair.selected}
                    onChange={() => togglePair(pair.id)}
                    className="h-3.5 w-3.5 rounded border-border flex-shrink-0"
                  />
                  <Input
                    value={pair.word}
                    onChange={(e) => updatePair(i, 'word', e.target.value)}
                    className="font-medium h-8 w-28 sm:w-36 flex-shrink-0"
                    placeholder="Word"
                  />
                  <Input
                    value={pair.definition}
                    onChange={(e) => updatePair(i, 'definition', e.target.value)}
                    className="h-8 flex-1 min-w-0"
                    placeholder="Definition"
                  />
                </div>
                {pair.alreadyExists && pair.existingDefinition && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 pl-6 pb-0.5">
                    In deck: {stripHtml(pair.existingDefinition)}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground flex-shrink-0">Tags</label>
              <Input
                value={extraTag}
                onChange={(e) => onExtraTagChange(e.target.value)}
                className="h-7 text-sm max-w-[200px]"
                placeholder="chapter-3, verbs"
              />
            </div>
            <div className="flex items-center justify-between">
              {generateCostEstimate && selectedCount > 0 ? (
                <p className="text-xs text-muted-foreground">Est. {generateCostEstimate}</p>
              ) : (
                <div />
              )}
              <Button size="sm" onClick={handleGenerate} disabled={selectedCount === 0}>
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                Generate examples ({selectedCount})
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              AI will create example sentences for each word. You can review them before adding
              cards to Anki.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
