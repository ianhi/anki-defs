import { useEffect, useState, type MutableRefObject } from 'react';
import type { CardPreview as CardPreviewType, PdfExtractRequest, ScoutedSection } from 'shared';
import { Button } from '../ui/Button';
import { CardPreview } from '../CardPreview';
import { pdfApi } from '@/lib/api';
import { useSettingsStore } from '@/hooks/useSettings';
import { getSectionText, type ExtractedOutline } from '@/lib/pdf';

interface Props {
  outline: ExtractedOutline;
  scouted: ScoutedSection[];
  selectedIds: Set<string>;
  sourceTag: string;
  previews: CardPreviewType[];
  onPreviewsChange: (previews: CardPreviewType[]) => void;
  abortRef: MutableRefObject<AbortController | null>;
  onRestart: () => void;
}

function buildRequest(
  primary: ScoutedSection,
  byId: Map<string, ScoutedSection>,
  outline: ExtractedOutline,
  tags: string[],
  deck: string | undefined,
): PdfExtractRequest {
  const supporting = primary.relatedTo
    .map((id) => byId.get(id))
    .filter((s): s is ScoutedSection => !!s)
    .map((s) => ({
      id: s.id,
      contentType: s.contentType,
      heading: s.heading,
      text: getSectionText(outline, s.id),
    }));
  return {
    primary: {
      id: primary.id,
      contentType: primary.contentType,
      heading: primary.heading,
      text: getSectionText(outline, primary.id),
    },
    supporting,
    tags,
    deck,
  };
}

export function PdfExtractStep({
  outline,
  scouted,
  selectedIds,
  sourceTag,
  previews,
  onPreviewsChange,
  abortRef,
  onRestart,
}: Props) {
  const { settings } = useSettingsStore();
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    const selected = scouted.filter((s) => selectedIds.has(s.id));
    const byId = new Map(scouted.map((s) => [s.id, s]));
    const collected: CardPreviewType[] = [];

    (async () => {
      for (let i = 0; i < selected.length; i++) {
        if (controller.signal.aborted) return;
        const section = selected[i]!;
        setStatus(`Extracting section ${i + 1}/${selected.length}: ${section.heading}`);
        const tags = [sourceTag, ...section.suggestedTags].filter(Boolean);
        const req = buildRequest(section, byId, outline, tags, settings.defaultDeck);
        try {
          for await (const event of pdfApi.extract(req, controller.signal)) {
            if (event.type === 'card_preview') {
              collected.push(event.data);
              onPreviewsChange([...collected]);
            } else if (event.type === 'error') {
              setError(event.data);
            }
          }
        } catch (e) {
          if (controller.signal.aborted) return;
          setError(e instanceof Error ? e.message : 'Extract failed');
          return;
        }
      }
      setStatus('');
      setDone(true);
    })();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{status || (done ? 'Done.' : '')}</span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onRestart}>
          New PDF
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        {previews.map((p, i) => (
          <CardPreview key={`${p.word}-${i}`} preview={p} extraTags={p.tags} />
        ))}
      </div>
    </div>
  );
}
