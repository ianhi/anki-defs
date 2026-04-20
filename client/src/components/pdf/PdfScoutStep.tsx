import { useEffect, useRef, useState } from 'react';
import type { PdfContentType, PdfSection, ScoutedSection } from 'shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { pdfApi } from '@/lib/api';
import { useSettingsStore } from '@/hooks/useSettings';

interface Props {
  sectionsToScout: PdfSection[];
  sourceTag: string;
  onSourceTagChange: (s: string) => void;
  onScouted: (sections: ScoutedSection[], picked: Set<string>) => void;
}

const TYPE_STYLE: Record<PdfContentType, { color: string; label: string }> = {
  vocab: { color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', label: 'Vocab' },
  glossary: { color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300', label: 'Glossary' },
  passage: { color: 'bg-green-500/10 text-green-700 dark:text-green-300', label: 'Passage' },
  exercise: { color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', label: 'Exercise' },
  prose: { color: 'bg-muted text-muted-foreground', label: 'Grammar / prose' },
};

export function PdfScoutStep({
  sectionsToScout,
  sourceTag,
  onSourceTagChange,
  onScouted,
}: Props) {
  const { settings } = useSettingsStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<ScoutedSection[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pdfApi
      .scout({ sections: sectionsToScout, deck: settings.defaultDeck })
      .then((r) => {
        if (cancelled) return;
        setSections(r.sections);
        setPicked(new Set(r.sections.filter((s) => s.worthExtracting).map((s) => s.id)));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Scout failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sectionsToScout, settings.defaultDeck]);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (loading) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  if (loading)
    return (
      <div className="p-6 flex flex-col items-center gap-3">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">
          Scouting {sectionsToScout.length} section{sectionsToScout.length === 1 ? '' : 's'}…
        </p>
        <p className="text-xs text-muted-foreground">
          {elapsed}s elapsed — typically takes 10–30 seconds
        </p>
        <p className="text-xs text-muted-foreground/60">
          If something goes wrong, an error will appear here.
        </p>
      </div>
    );
  if (error)
    return (
      <div className="p-6 max-w-lg mx-auto">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );

  const extractable = sections.filter((s) => s.contentType !== 'prose');

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <p className="text-sm text-muted-foreground">
        {extractable.length} of {sections.length} sections can produce flashcards.
        Checked sections will be extracted. Grammar/prose sections are skipped by default.
      </p>

      <div className="flex flex-wrap gap-2 text-[10px]">
        {(['vocab', 'passage', 'glossary', 'exercise', 'prose'] as PdfContentType[]).map((t) => {
          const count = sections.filter((s) => s.contentType === t).length;
          if (count === 0) return null;
          const style = TYPE_STYLE[t];
          return (
            <span key={t} className={`px-1.5 py-0.5 rounded ${style.color}`}>
              {style.label} ({count})
            </span>
          );
        })}
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Source tag (applied to every card)</label>
        <Input value={sourceTag} onChange={(e) => onSourceTagChange(e.target.value)} />
      </div>

      <div className="border border-border rounded-md divide-y divide-border">
        {sections.map((s) => {
          const on = picked.has(s.id);
          return (
            <label
              key={s.id}
              className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 ${
                s.contentType === 'prose' && !on ? 'opacity-50' : ''
              }`}
            >
              <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${TYPE_STYLE[s.contentType]?.color ?? ''}`}
                  >
                    {TYPE_STYLE[s.contentType]?.label ?? s.contentType}
                  </span>
                  <span className="font-medium truncate">{s.heading}</span>
                  <span className="text-xs text-muted-foreground">
                    pp. {s.pageStart}
                    {s.pageEnd !== s.pageStart ? `–${s.pageEnd}` : ''}
                  </span>
                </div>
                {s.suggestedTags.length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    tags: {s.suggestedTags.join(', ')}
                  </div>
                )}
                {s.relatedTo.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    → linked: {s.relatedTo.join(', ')}
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button onClick={() => onScouted(sections, picked)} disabled={picked.size === 0}>
          Extract {picked.size} section{picked.size === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}
