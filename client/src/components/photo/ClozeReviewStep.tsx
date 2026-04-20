import { useState, useCallback } from 'react';
import type { ClozeItem, ClozeBlank } from 'shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { X } from 'lucide-react';
import { useSettingsStore } from '@/hooks/useSettings';
import { useCreateNote } from '@/hooks/useAnki';
import { useSessionCards } from '@/hooks/useSessionCards';

interface Props {
  items: ClozeItem[];
  unsupported: string[];
  extraTag: string;
  onExtraTagChange: (s: string) => void;
  onReset: () => void;
  onGoBack: () => void;
}

function buildClozeText(item: EditableItem): string {
  let text = item.sentence;
  item.blanks.forEach((b, i) => {
    const n = i + 1;
    const hint = b.hint?.replace(/^\((.+)\)$/, '$1') ?? null;
    const cloze = hint ? `{{c${n}::${b.answer}::${hint}}}` : `{{c${n}::${b.answer}}}`;
    text = text.replace(`__${n}__`, cloze);
  });
  return text;
}

function buildFullSentence(item: EditableItem): string {
  let text = item.sentence;
  item.blanks.forEach((b, i) => {
    text = text.replace(`__${i + 1}__`, b.answer);
  });
  return text;
}

interface EditableItem extends ClozeItem {
  blanks: EditableBlank[];
}

interface EditableBlank extends ClozeBlank {
  answer: string;
  hint: string | null;
}

function deepCloneItems(items: ClozeItem[]): EditableItem[] {
  return items.map((item) => ({
    ...item,
    blanks: item.blanks.map((b) => ({ ...b })),
  }));
}

// Render a sentence with __N__ markers replaced by inline inputs.
function SentenceWithBlanks({
  item,
  onBlankChange,
}: {
  item: EditableItem;
  onBlankChange: (blankIdx: number, field: 'answer' | 'hint', value: string) => void;
}) {
  const parts: Array<{ type: 'text'; text: string } | { type: 'blank'; index: number }> = [];
  const regex = /__(\d+)__/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(item.sentence)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ type: 'text', text: item.sentence.slice(lastIndex, m.index) });
    }
    parts.push({ type: 'blank', index: parseInt(m[1]!, 10) - 1 });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < item.sentence.length) {
    parts.push({ type: 'text', text: item.sentence.slice(lastIndex) });
  }

  return (
    <div className="leading-8 flex flex-wrap items-baseline gap-x-1">
      {parts.map((part, i) =>
        part.type === 'text' ? (
          <span key={i}>{part.text}</span>
        ) : (
          <span key={i} className="inline-flex flex-col items-start">
            <input
              value={item.blanks[part.index]?.answer ?? ''}
              onChange={(e) => onBlankChange(part.index, 'answer', e.target.value)}
              className="border-b-2 border-primary bg-transparent text-center font-medium w-28 focus:outline-none"
            />
            {item.blanks[part.index]?.hint != null && (
              <input
                value={item.blanks[part.index]?.hint ?? ''}
                onChange={(e) => onBlankChange(part.index, 'hint', e.target.value)}
                className="text-[10px] text-muted-foreground bg-transparent text-center w-28 focus:outline-none"
                placeholder="hint"
              />
            )}
          </span>
        ),
      )}
    </div>
  );
}

export function ClozeReviewStep({
  items: initialItems,
  unsupported,
  extraTag,
  onExtraTagChange,
  onReset,
  onGoBack,
}: Props) {
  const [items, setItems] = useState<EditableItem[]>(() => deepCloneItems(initialItems));
  const [discarded, setDiscarded] = useState<Set<number>>(new Set());
  const [addingAll, setAddingAll] = useState(false);
  const [addResult, setAddResult] = useState<{ added: number } | null>(null);
  const { settings } = useSettingsStore();
  const createNote = useCreateNote();
  const { addCard, addToPendingQueue } = useSessionCards();

  const activeItems = items.filter((_, i) => !discarded.has(i));

  const handleBlankChange = useCallback(
    (itemIdx: number, blankIdx: number, field: 'answer' | 'hint', value: string) => {
      setItems((prev) => {
        const next = [...prev];
        const item = { ...next[itemIdx]!, blanks: [...next[itemIdx]!.blanks] };
        item.blanks[blankIdx] = { ...item.blanks[blankIdx]!, [field]: value || null };
        next[itemIdx] = item;
        return next;
      });
    },
    [],
  );

  const handleTranslationChange = useCallback((itemIdx: number, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[itemIdx] = { ...next[itemIdx]!, translation: value };
      return next;
    });
  }, []);

  const toggleDiscard = useCallback((idx: number) => {
    setDiscarded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleAddAll = useCallback(async () => {
    setAddingAll(true);
    setAddResult(null);
    let added = 0;
    const tags = [
      'auto-generated',
      'photo-cloze',
      ...extraTag
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ];

    for (let i = 0; i < items.length; i++) {
      if (discarded.has(i)) continue;
      const item = items[i]!;
      const clozeText = buildClozeText(item);
      const fullSentence = buildFullSentence(item);

      try {
        const result = await createNote.mutateAsync({
          deck: settings.defaultDeck,
          cardType: 'cloze',
          word: clozeText,
          definition: '',
          nativeDefinition: '',
          example: fullSentence,
          translation: item.translation,
          tags,
        });
        addCard(
          {
            word: clozeText,
            definition: '',
            nativeDefinition: '',
            exampleSentence: fullSentence,
            sentenceTranslation: item.translation,
          },
          settings.defaultDeck,
          result.modelName,
          result.noteId,
        );
        added++;
      } catch {
        addToPendingQueue(
          {
            word: clozeText,
            definition: '',
            nativeDefinition: '',
            exampleSentence: fullSentence,
            sentenceTranslation: item.translation,
          },
          settings.defaultDeck,
          '',
        );
        added++;
      }
    }

    setAddingAll(false);
    setAddResult({ added });
  }, [items, discarded, settings.defaultDeck, createNote, addCard, addToPendingQueue, extraTag]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {activeItems.length} cloze item{activeItems.length === 1 ? '' : 's'}
        </span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onGoBack}>
          Back
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Start over
        </Button>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Extra tags (comma-separated)</label>
        <Input value={extraTag} onChange={(e) => onExtraTagChange(e.target.value)} />
      </div>

      <div className="space-y-3">
        {items.map((item, i) => {
          if (discarded.has(i)) return null;
          return (
            <div
              key={i}
              className={`rounded-md border p-3 space-y-2 ${
                item.confidence === 'low'
                  ? 'border-amber-400 bg-amber-500/5'
                  : 'border-border'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {item.contextPreamble && (
                    <p className="text-xs text-muted-foreground italic mb-1">
                      {item.contextPreamble}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    {item.itemNumber != null && (
                      <span className="text-xs text-muted-foreground font-mono">
                        #{item.itemNumber}
                      </span>
                    )}
                    {item.confidence === 'low' && (
                      <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px]">
                        low confidence
                      </Badge>
                    )}
                  </div>
                  <SentenceWithBlanks
                    item={item}
                    onBlankChange={(bIdx, field, val) => handleBlankChange(i, bIdx, field, val)}
                  />
                  <div className="mt-2">
                    <input
                      value={item.translation}
                      onChange={(e) => handleTranslationChange(i, e.target.value)}
                      className="text-xs text-muted-foreground bg-transparent w-full focus:outline-none border-b border-transparent focus:border-muted-foreground/30"
                      placeholder="Translation"
                    />
                  </div>
                </div>
                <button
                  onClick={() => toggleDiscard(i)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Discard item"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {unsupported.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Skipped (open-ended/unsupported):</p>
          {unsupported.map((s, i) => (
            <p key={i} className="pl-3">- {s}</p>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleAddAll} disabled={addingAll || activeItems.length === 0}>
          {addingAll ? 'Adding...' : `Add ${activeItems.length} to Anki`}
        </Button>
      </div>

      {addResult && (
        <p className="text-sm text-green-600">{addResult.added} cards added to Anki.</p>
      )}
    </div>
  );
}
