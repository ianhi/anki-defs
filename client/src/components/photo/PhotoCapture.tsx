import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import imageCompression from 'browser-image-compression';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import type { CardPreview as CardPreviewType, VocabPair, TokenUsage } from 'shared';
import { computeCost, MODEL_PRICING } from 'shared';
import { CardPreview } from '../CardPreview';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Camera,
  Upload,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ImageIcon,
  Crop as CropIcon,
} from 'lucide-react';
import { photoApi } from '@/lib/api';
import { useSettingsStore } from '@/hooks/useSettings';
import { useCreateNote } from '@/hooks/useAnki';
import { useSessionCards } from '@/hooks/useSessionCards';
import { generateId, stripHtml } from '@/lib/utils';

type Step = 'upload' | 'extract' | 'generate';

interface IdentifiedPair extends VocabPair {
  id: string;
  selected: boolean;
}

function estimateGenerateCost(n: number, model: string): string | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;
  if (pricing.input === 0 && pricing.output === 0) return 'Free';
  const cost = (n * (600 * pricing.input + 80 * pricing.output)) / 1_000_000;
  if (cost < 0.001) return '<$0.001';
  return `~$${cost.toFixed(3)}`;
}

function formatCost(usage: TokenUsage): string {
  const cost = computeCost(usage);
  if (cost === 0) return '';
  if (cost < 0.001) return '<$0.001';
  return `$${cost.toFixed(3)}`;
}

export function PhotoCapture({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('upload');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [pairs, setPairs] = useState<IdentifiedPair[]>([]);
  const [cardPreviews, setCardPreviews] = useState<CardPreviewType[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraTag, setExtraTag] = useState('');
  const [extractUsage, setExtractUsage] = useState<TokenUsage | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [addAllResult, setAddAllResult] = useState<{ added: number } | null>(null);
  const { settings } = useSettingsStore();
  const createNote = useCreateNote();
  const { addCard, addToPendingQueue } = useSessionCards();

  const selectedPairs = useMemo(() => pairs.filter((p) => p.selected && p.word.trim()), [pairs]);
  const selectedCount = selectedPairs.length;
  const duplicateCount = useMemo(() => pairs.filter((p) => p.alreadyExists).length, [pairs]);
  const newCount = pairs.length - duplicateCount;

  const [examples, setExamples] = useState<string[]>([]);
  const isDev = import.meta.env.DEV;

  const generateCostEstimate = useMemo(
    () => estimateGenerateCost(selectedCount, settings.geminiModel || 'gemini-2.5-flash'),
    [selectedCount, settings.geminiModel]
  );

  useEffect(() => {
    if (isDev) {
      photoApi.listExamples().then((r) => setExamples(r.examples));
    }
    return () => {
      abortRef.current?.abort();
      // imageUrl cleanup handled via imageUrlRef to avoid stale closure
    };
  }, [isDev]);

  const setImage = useCallback(
    (blob: Blob) => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImageBlob(blob);
      setImageUrl(URL.createObjectURL(blob));
      setCrop(undefined);
      setStep('extract');
      setError(null);
    },
    [imageUrl]
  );

  const loadExample = useCallback(
    async (filename: string) => {
      try {
        const result = await photoApi.getExample(filename);
        const binary = atob(result.imageBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        setImage(new Blob([bytes], { type: result.mimeType }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load example');
      }
    },
    [setImage]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: 1500,
          useWebWorker: true,
          fileType: 'image/jpeg',
        });
        setImage(compressed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load image');
      }
    },
    [setImage]
  );

  const getImageBlob = useCallback(async (): Promise<Blob | null> => {
    // Cropped region: render crop to canvas, export as blob
    if (crop && crop.width > 0 && crop.height > 0) {
      const image = imgRef.current;
      if (!image) return null;
      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const cropX = crop.unit === '%' ? (crop.x / 100) * image.width : crop.x;
      const cropY = crop.unit === '%' ? (crop.y / 100) * image.height : crop.y;
      const cropW = crop.unit === '%' ? (crop.width / 100) * image.width : crop.width;
      const cropH = crop.unit === '%' ? (crop.height / 100) * image.height : crop.height;
      canvas.width = cropW * scaleX;
      canvas.height = cropH * scaleY;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(
        image,
        cropX * scaleX,
        cropY * scaleY,
        cropW * scaleX,
        cropH * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
      });
    }

    return imageBlob;
  }, [crop, imageBlob]);

  const handleExtract = useCallback(async () => {
    const blob = await getImageBlob();
    if (!blob) return;

    setIsExtracting(true);
    setError(null);

    try {
      const result = await photoApi.extract(blob, settings.defaultDeck);
      const newPairs: IdentifiedPair[] = result.pairs.map((p) => ({
        ...p,
        id: generateId(),
        selected: !p.alreadyExists,
      }));
      setPairs((prev) => {
        const existingWords = new Set(prev.map((p) => p.word.toLowerCase()));
        const unique = newPairs.filter((p) => !existingWords.has(p.word.toLowerCase()));
        return [...prev, ...unique];
      });
      if (result.usage) {
        setExtractUsage((prev) =>
          prev
            ? {
                ...prev,
                inputTokens: prev.inputTokens + result.usage!.inputTokens,
                outputTokens: prev.outputTokens + result.usage!.outputTokens,
              }
            : result.usage!
        );
      }
      setCrop(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract vocab from image');
    } finally {
      setIsExtracting(false);
    }
  }, [getImageBlob, settings.defaultDeck]);

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

  const handleGenerate = useCallback(async () => {
    if (selectedPairs.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setCardPreviews([]);
    setError(null);
    setStep('generate');

    try {
      for await (const event of photoApi.generate(
        selectedPairs,
        settings.defaultDeck,
        controller.signal
      )) {
        switch (event.type) {
          case 'card_preview':
            setCardPreviews((prev) => [...prev, event.data]);
            break;
          case 'usage':
            break;
          case 'error':
            setError(event.data);
            break;
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedPairs, settings.defaultDeck]);

  const handleAddAll = useCallback(async () => {
    const nonDuplicates = cardPreviews.filter((p) => !p.alreadyExists);
    if (nonDuplicates.length === 0) return;

    setAddingAll(true);
    setAddAllResult(null);
    let added = 0;

    for (const preview of nonDuplicates) {
      try {
        const result = await createNote.mutateAsync({
          deck: settings.defaultDeck,
          cardType: 'vocab',
          word: preview.word,
          definition: preview.definition,
          nativeDefinition: preview.nativeDefinition,
          example: preview.exampleSentence,
          translation: preview.sentenceTranslation,
          tags: [
            'auto-generated',
            ...extraTag
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
          ],
        });
        addCard(preview, settings.defaultDeck, result.modelName, result.noteId);
        added++;
      } catch {
        // If Anki is down, queue the card
        addToPendingQueue(preview, settings.defaultDeck, '');
        added++;
      }
    }

    setAddingAll(false);
    setAddAllResult({ added });
  }, [cardPreviews, settings.defaultDeck, createNote, addCard, addToPendingQueue, extraTag]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setStep('upload');
    setImageUrl(null);
    setImageBlob(null);
    setCrop(undefined);
    setPairs([]);
    setCardPreviews([]);
    setError(null);
    setExtractUsage(null);
    setExtraTag('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back to chat">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-medium text-sm">Photo to Flashcards</h2>
        {step !== 'upload' && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto text-xs">
            Start over
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 px-4">
            <ImageIcon className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground text-sm text-center max-w-xs">
              Take a photo or upload an image of a vocabulary list from your textbook.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute('capture');
                    fileInputRef.current.click();
                  }
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute('capture', 'environment');
                    fileInputRef.current.click();
                  }
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
            </div>
            {isDev && examples.length > 0 && (
              <div className="flex flex-col items-center gap-2 pt-4 border-t border-border w-full max-w-xs">
                <p className="text-xs text-muted-foreground">Dev: load example image</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {examples.map((name) => (
                    <Button
                      key={name}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => loadExample(name)}
                    >
                      {name.length > 20 ? name.slice(0, 17) + '...' : name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Extract & Review (combined) */}
        {step === 'extract' && imageUrl && (
          <div className="space-y-3 pb-4">
            {/* Image with crop tool — constrained so extract button stays visible */}
            <div className="border-b border-border">
              <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="Textbook photo"
                  className="max-w-full max-h-[50vh] object-contain"
                />
              </ReactCrop>
            </div>

            {/* Extract controls */}
            <div className="px-4 space-y-1.5">
              {pairs.length === 0 && !crop && (
                <p className="text-xs text-muted-foreground">
                  Drag on the image to select a region, or extract the whole image.
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleExtract} disabled={isExtracting}>
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <CropIcon className="h-3.5 w-3.5 mr-1.5" />
                      {crop && crop.width > 0 ? 'Extract selection' : 'Extract all'}
                    </>
                  )}
                </Button>
                {extractUsage && (
                  <span className="text-xs text-muted-foreground">
                    {extractUsage.inputTokens + extractUsage.outputTokens} tok
                    {formatCost(extractUsage) && ` (${formatCost(extractUsage)})`}
                  </span>
                )}
              </div>
            </div>

            {/* Extracted pairs with selection */}
            {pairs.length > 0 && (
              <div className="px-4 space-y-3 max-w-md">
                {/* Header with counts and selection controls */}
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

                {/* Pair list */}
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

                {/* Tags and generate */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground flex-shrink-0">Tags</label>
                    <Input
                      value={extraTag}
                      onChange={(e) => setExtraTag(e.target.value)}
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
                    AI will create example sentences for each word. You can review them before
                    adding cards to Anki.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review examples & add to Anki */}
        {step === 'generate' && (
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
                <Button
                  size="sm"
                  onClick={handleAddAll}
                  disabled={addingAll || cardPreviews.filter((p) => !p.alreadyExists).length === 0}
                >
                  {addingAll ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    `Add all new (${cardPreviews.filter((p) => !p.alreadyExists).length})`
                  )}
                </Button>
                {addAllResult && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {addAllResult.added} added
                    </span>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      New image
                    </Button>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cardPreviews.map((preview, i) => (
                <CardPreview
                  key={`${preview.word}-${i}`}
                  preview={preview}
                  extraTags={extraTag
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)}
                />
              ))}
            </div>

            {!isGenerating && (
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('extract')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to image
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  New image
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
