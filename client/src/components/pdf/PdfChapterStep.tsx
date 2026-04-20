import { useState } from 'react';
import type { PdfChapter } from 'shared';
import { Button } from '../ui/Button';
import type { ExtractedOutline } from '@/lib/pdf';

interface Props {
  outline: ExtractedOutline;
  onSelected: (chapterIds: string[]) => void;
}

export function PdfChapterStep({ outline, onSelected }: Props) {
  const { chapters } = outline;
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const selectAll = () => setPicked(new Set(chapters.map((c) => c.id)));
  const selectNone = () => setPicked(new Set());

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <p className="text-sm text-muted-foreground">
        {chapters.length} chapters found. Pick which to scout for extractable content.
      </p>

      <div className="flex gap-2 text-xs">
        <button className="text-primary underline" onClick={selectAll}>
          Select all
        </button>
        <button className="text-primary underline" onClick={selectNone}>
          Select none
        </button>
      </div>

      <div className="border border-border rounded-md divide-y divide-border max-h-[60vh] overflow-auto">
        {chapters.map((ch) => (
          <ChapterRow
            key={ch.id}
            chapter={ch}
            checked={picked.has(ch.id)}
            onToggle={() => toggle(ch.id)}
          />
        ))}
      </div>

      <Button onClick={() => onSelected([...picked])} disabled={picked.size === 0}>
        Scout {picked.size} chapter{picked.size === 1 ? '' : 's'}
      </Button>
    </div>
  );
}

function ChapterRow({
  chapter,
  checked,
  onToggle,
}: {
  chapter: PdfChapter;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <div className="flex-1 min-w-0">
        <span className="font-medium">{chapter.title}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          pp. {chapter.pageStart}
          {chapter.pageEnd !== chapter.pageStart ? `–${chapter.pageEnd}` : ''}
        </span>
        {chapter.sectionIds.length > 1 && (
          <span className="ml-2 text-xs text-muted-foreground">
            ({chapter.sectionIds.length} sections)
          </span>
        )}
      </div>
    </label>
  );
}
