import { useState } from 'react';
import type { ClozeItem, PhotoClozeExtractResponse, TokenUsage } from 'shared';
import { Button } from '../ui/Button';
import { photoApi } from '@/lib/api';
import { useSettingsStore } from '@/hooks/useSettings';
import { formatCost } from '@/lib/utils';

interface Props {
  imageUrl: string;
  imageBlob: Blob;
  onExtracted: (items: ClozeItem[], unsupported: string[]) => void;
}

export function ClozeTranscribeStep({ imageUrl, imageBlob, onExtracted }: Props) {
  const { settings } = useSettingsStore();
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    setError(null);
    try {
      const result = await photoApi.clozeTranscribe(imageBlob);
      setTranscription(result.transcription);
      if (result.usage) setUsage(result.usage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleExtract = async () => {
    if (!transcription) return;
    setIsExtracting(true);
    setError(null);
    try {
      const result: PhotoClozeExtractResponse = await photoApi.clozeExtract(
        transcription,
        settings.defaultDeck,
      );
      if (result.usage) {
        setUsage((prev) =>
          prev
            ? {
                ...prev,
                inputTokens: prev.inputTokens + result.usage!.inputTokens,
                outputTokens: prev.outputTokens + result.usage!.outputTokens,
              }
            : result.usage!,
        );
      }
      onExtracted(result.items, result.unsupported ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <img
        src={imageUrl}
        alt="Uploaded exercise"
        className="max-h-48 rounded-md border border-border object-contain mx-auto"
      />

      {transcription === null ? (
        <Button onClick={handleTranscribe} disabled={isTranscribing} className="w-full">
          {isTranscribing ? 'Transcribing...' : 'Transcribe exercise'}
        </Button>
      ) : (
        <>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Transcription (edit to fix OCR errors)
            </label>
            <textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              rows={Math.min(20, transcription.split('\n').length + 2)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
            />
          </div>

          <Button onClick={handleExtract} disabled={isExtracting || !transcription.trim()}>
            {isExtracting ? 'Extracting cloze items...' : 'Extract cloze items'}
          </Button>
        </>
      )}

      {usage && (
        <p className="text-xs text-muted-foreground">
          {usage.inputTokens + usage.outputTokens} tokens {formatCost(usage) && `(${formatCost(usage)})`}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
