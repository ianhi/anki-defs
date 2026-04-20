import { useState, useMemo } from 'react';
import type { ScoutedSection } from 'shared';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { PdfUploadStep } from './PdfUploadStep';
import { PdfChapterStep } from './PdfChapterStep';
import { PdfScoutStep } from './PdfScoutStep';
import { PdfExtractStep } from './PdfExtractStep';
import type { ExtractedOutline } from '@/lib/pdf';

type Step = 'upload' | 'chapters' | 'scout' | 'extract';

export function PdfPage({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('upload');
  const [outline, setOutline] = useState<ExtractedOutline | null>(null);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [scouted, setScouted] = useState<ScoutedSection[]>([]);
  const [sourceTag, setSourceTag] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter sections to only those belonging to selected chapters.
  // Memoized to avoid new array references triggering scout re-fire.
  const sectionsForScout = useMemo(() => {
    if (!outline) return [];
    const ids = new Set(
      outline.chapters
        .filter((ch) => selectedChapterIds.includes(ch.id))
        .flatMap((ch) => ch.sectionIds),
    );
    return outline.sections.filter((s) => ids.has(s.id));
  }, [outline, selectedChapterIds]);

  const handleRestart = () => {
    setOutline(null);
    setSelectedChapterIds([]);
    setScouted([]);
    setSelectedIds(new Set());
    setStep('upload');
  };

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
              setStep('chapters');
            }}
          />
        )}

        {step === 'chapters' && outline && (
          <PdfChapterStep
            outline={outline}
            onSelected={(chapterIds) => {
              setSelectedChapterIds(chapterIds);
              setStep('scout');
            }}
          />
        )}

        {step === 'scout' && outline && (
          <PdfScoutStep
            sectionsToScout={sectionsForScout}
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
            onBack={() => setStep('scout')}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
