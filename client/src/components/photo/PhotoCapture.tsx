import { useState, useRef, useCallback, useEffect } from 'react';
import type { CardPreview as CardPreviewType, VocabPair, TokenUsage } from 'shared';
import { Button } from '../ui/Button';
import { ArrowLeft } from 'lucide-react';
import { photoApi } from '@/lib/api';
import { useSettingsStore } from '@/hooks/useSettings';
import { useCreateNote } from '@/hooks/useAnki';
import { useSessionCards } from '@/hooks/useSessionCards';
import { useImageInput } from './useImageInput';
import { UploadStep } from './UploadStep';
import { ExtractStep } from './ExtractStep';
import { GenerateStep } from './GenerateStep';

type Step = 'upload' | 'extract' | 'generate';

export function PhotoCapture({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('upload');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [cardPreviews, setCardPreviews] = useState<CardPreviewType[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraTag, setExtraTag] = useState('');
  const [extractUsage, setExtractUsage] = useState<TokenUsage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [addAllResult, setAddAllResult] = useState<{ added: number } | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const { settings } = useSettingsStore();
  const createNote = useCreateNote();
  const { addCard, addToPendingQueue } = useSessionCards();

  const [examples, setExamples] = useState<string[]>([]);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (isDev) {
      photoApi.listExamples().then((r) => setExamples(r.examples));
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [isDev]);

  const setImage = useCallback(
    (blob: Blob) => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImageBlob(blob);
      setImageUrl(URL.createObjectURL(blob));
      setStep('extract');
      setError(null);
    },
    [imageUrl]
  );

  const { handleFileSelect, handleDrop, handleDragOver, handleDragLeave, isDragging } =
    useImageInput(setImage, setError);

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

  const handleExtract = useCallback(
    async (blob: Blob, instructions: string): Promise<VocabPair[]> => {
      setIsExtracting(true);
      setError(null);
      try {
        const result = await photoApi.extract(blob, settings.defaultDeck, instructions);
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
        return result.pairs;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to extract vocab from image');
        return [];
      } finally {
        setIsExtracting(false);
      }
    },
    [settings.defaultDeck]
  );

  const handleGenerate = useCallback(
    async (pairs: VocabPair[]) => {
      if (pairs.length === 0) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setCardPreviews([]);
      setError(null);
      setStep('generate');
      setSelectedCount(pairs.length);

      try {
        for await (const event of photoApi.generate(
          pairs,
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
    },
    [settings.defaultDeck]
  );

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
    setCardPreviews([]);
    setError(null);
    setExtractUsage(null);
    setExtraTag('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [imageUrl]);

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

        {step === 'upload' && (
          <UploadStep
            fileInputRef={fileInputRef}
            handleFileSelect={handleFileSelect}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            isDev={isDev}
            examples={examples}
            loadExample={loadExample}
          />
        )}

        {step === 'extract' && imageUrl && imageBlob && (
          <ExtractStep
            imageUrl={imageUrl}
            imageBlob={imageBlob}
            geminiModel={settings.geminiModel || 'gemini-2.5-flash'}
            extractUsage={extractUsage}
            onExtract={handleExtract}
            onGenerate={handleGenerate}
            isExtracting={isExtracting}
            extraTag={extraTag}
            onExtraTagChange={setExtraTag}
          />
        )}

        {step === 'generate' && (
          <GenerateStep
            cardPreviews={cardPreviews}
            selectedCount={selectedCount}
            isGenerating={isGenerating}
            extraTag={extraTag}
            handleAddAll={handleAddAll}
            addingAll={addingAll}
            addAllResult={addAllResult}
            handleReset={handleReset}
            goBack={() => setStep('extract')}
          />
        )}
      </div>
    </div>
  );
}
