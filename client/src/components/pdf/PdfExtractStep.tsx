import { useEffect, useState } from 'react';
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
  onBack: () => void;
  onRestart: () => void;
}

function buildRequest(
  primary: ScoutedSection,
  byId: Map<string, ScoutedSection>,
  outline: ExtractedOutline,
  tags: string[],
  deck: string | undefined
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
  onBack,
  onRestart,
}: Props) {
  const { settings } = useSettingsStore();
  const [status, setStatus] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [previews, setPreviews] = useState<CardPreviewType[]>([]);

  useEffect(() => {
    const controller = new AbortController();
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
              setPreviews([...collected]);
            } else if (event.type === 'error') {
              setErrors((prev) => [...prev, `${section.heading}: ${event.data}`]);
            }
            // 'skipped' events are informational — just continue
          }
        } catch (e) {
          if (controller.signal.aborted) return;
          setErrors((prev) => [
            ...prev,
            `${section.heading}: ${e instanceof Error ? e.message : 'Extract failed'}`,
          ]);
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

  const selected = scouted.filter((s) => selectedIds.has(s.id));

  return (
    <div className="p-4 space-y-3 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        {!done && status && (
          <>
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">{status}</span>
          </>
        )}
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={onBack}>
            Back to sections
          </Button>
          <Button variant="ghost" size="sm" onClick={onRestart}>
            New PDF
          </Button>
        </div>
      </div>

      {done && (
        <div className="rounded-md border border-border p-4 space-y-2">
          {previews.length > 0 ? (
            <p className="text-sm font-medium">
              {previews.length} card{previews.length === 1 ? '' : 's'} ready for review
            </p>
          ) : (
            <p className="text-sm font-medium">No cards produced</p>
          )}
          {errors.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {errors.length} section{errors.length === 1 ? '' : 's'} skipped
              {selected.length > 0 && ` (of ${selected.length} selected)`}
            </p>
          )}
          {previews.length === 0 && (
            <>
              <p className="text-xs text-muted-foreground">
                The selected sections were grammar/prose or exercises without a cloze prompt. Try
                selecting sections classified as Vocab or Passage.
              </p>
              <Button variant="outline" size="sm" onClick={onBack} className="mt-2">
                Back to sections
              </Button>
            </>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Skipped sections</summary>
          <div className="mt-1 space-y-0.5 pl-3">
            {errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        </details>
      )}

      <div className="space-y-2">
        {previews.map((p, i) => (
          <CardPreview key={`${p.word}-${i}`} preview={p} extraTags={p.tags} />
        ))}
      </div>
    </div>
  );
}
