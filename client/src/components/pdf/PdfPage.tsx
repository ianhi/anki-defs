import { useState, useRef } from 'react';
import type { CardPreview as CardPreviewType, ScoutedSection } from 'shared';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { PdfUploadStep } from './PdfUploadStep';
import { PdfScoutStep } from './PdfScoutStep';
import { PdfExtractStep } from './PdfExtractStep';
import type { ExtractedOutline } from '@/lib/pdf';

type Step = 'upload' | 'scout' | 'extract';

export function PdfPage({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('upload');
  const [outline, setOutline] = useState<ExtractedOutline | null>(null);
  const [scouted, setScouted] = useState<ScoutedSection[]>([]);
  const [sourceTag, setSourceTag] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<CardPreviewType[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-medium">PDF to flashcards</h2>
        <span className="ml-auto text-xs text-muted-foreground">{step}</span>
      </div>

      <div className="flex-1 overflow-auto">
        {step === 'upload' && (
          <PdfUploadStep
            onReady={(o, filenameTag) => {
              setOutline(o);
              setSourceTag(filenameTag);
              setStep('scout');
            }}
          />
        )}

        {step === 'scout' && outline && (
          <PdfScoutStep
            outline={outline}
            sourceTag={sourceTag}
            onSourceTagChange={setSourceTag}
            onScouted={(list, picked) => {
              setScouted(list);
              setSelectedIds(picked);
              setStep('extract');
            }}
          />
        )}

        {step === 'extract' && outline && (
          <PdfExtractStep
            outline={outline}
            scouted={scouted}
            selectedIds={selectedIds}
            sourceTag={sourceTag}
            previews={previews}
            onPreviewsChange={setPreviews}
            abortRef={abortRef}
            onRestart={() => {
              abortRef.current?.abort();
              setOutline(null);
              setScouted([]);
              setSelectedIds(new Set());
              setPreviews([]);
              setStep('upload');
            }}
          />
        )}
      </div>
    </div>
  );
}
