import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Check, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from './ui/Button';
import { useNoteTypeHealth, useUpdateTemplates } from '@/hooks/useAnki';
import type { NoteTypeIssue, StaleTemplate } from 'shared';

function formatVersionRange(current: number | null, latest: number): string {
  if (current === null) return `unversioned → v${latest}`;
  return `v${current} → v${latest}`;
}

/** Side-by-side current vs editable proposed template */
function TemplateEditor({
  label,
  current,
  proposed,
  onChange,
}: {
  label: string;
  current: string;
  proposed: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">
            Current
          </p>
          <pre className="p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-muted rounded border border-border overflow-auto max-h-52 text-foreground/70">
            {current || <span className="italic text-muted-foreground">(empty)</span>}
          </pre>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">
            Proposed (editable)
          </p>
          <textarea
            className="w-full p-2 text-[11px] font-mono leading-relaxed bg-background rounded border border-primary/30 text-foreground overflow-auto max-h-52 min-h-32 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
            value={proposed}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

/** Check if all issues have the same changes. */
function issuesAreIdentical(issues: NoteTypeIssue[]): boolean {
  if (issues.length <= 1) return true;
  const first = issues[0]!;
  return issues.every(
    (issue) =>
      issue.cardType === first.cardType &&
      issue.latestVersion === first.latestVersion &&
      issue.cssOutdated === first.cssOutdated &&
      issue.missingFields.join(',') === first.missingFields.join(',') &&
      issue.staleTemplates.length === first.staleTemplates.length &&
      issue.staleTemplates.every(
        (t, i) => t.currentVersion === first.staleTemplates[i]?.currentVersion
      )
  );
}

/** Editable state for all templates of an issue */
type EditState = Record<string, { front: string; back: string }>;

function buildEditState(templates: StaleTemplate[]): EditState {
  const state: EditState = {};
  for (const t of templates) {
    state[t.name] = { front: t.proposed.front, back: t.proposed.back };
  }
  return state;
}

/** Full-screen editable diff + update view */
function HealthDetail({ issues, onClose }: { issues: NoteTypeIssue[]; onClose: () => void }) {
  const update = useUpdateTemplates();
  const [updated, setUpdated] = useState<Set<string>>(new Set());
  const consolidated = issuesAreIdentical(issues);
  const representative = issues[0]!;

  // Editable template state — initialized from proposed templates
  const [edits, setEdits] = useState<EditState>(() =>
    buildEditState(representative.staleTemplates)
  );
  const [cssEdit, setCssEdit] = useState(representative.proposedCss ?? '');

  const allUpdated = issues.every((i) => updated.has(i.modelName));

  const handleUpdate = (modelName: string) => {
    update.mutate(
      {
        modelName,
        templates: Object.keys(edits).length > 0 ? edits : undefined,
        css: representative.cssOutdated ? cssEdit : undefined,
      },
      { onSuccess: () => setUpdated((prev) => new Set(prev).add(modelName)) }
    );
  };

  const handleUpdateAll = () => {
    for (const issue of issues) {
      if (!updated.has(issue.modelName)) handleUpdate(issue.modelName);
    }
  };

  const updateEdit = (tmplName: string, side: 'front' | 'back', value: string) => {
    setEdits((prev) => ({
      ...prev,
      [tmplName]: { ...prev[tmplName]!, [side]: value },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-medium">Note Type Updates</h2>
          <p className="text-xs text-muted-foreground">
            {consolidated && issues.length > 1
              ? `Same changes for ${issues.length} note types`
              : `${issues.length} note type${issues.length > 1 ? 's' : ''} need updating`}
          </p>
        </div>
        {allUpdated ? (
          <Button variant="outline" onClick={onClose}>
            <Check className="h-4 w-4 mr-1.5 text-green-500" />
            Done
          </Button>
        ) : (
          <Button disabled={update.isPending} onClick={handleUpdateAll}>
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {issues.length === 1 ? 'Apply Changes' : `Apply All (${issues.length})`}
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-5xl mx-auto w-full">
        {/* Sync warning */}
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2.5">
          Updating templates forces a one-way sync. You can edit the proposed templates below to
          keep your customizations (e.g. specific TTS voices).
        </p>

        {/* Missing fields */}
        {representative.missingFields.length > 0 && (
          <div className="text-sm">
            <span className="font-medium">New fields: </span>
            <span className="text-green-700 dark:text-green-400">
              {representative.missingFields.join(', ')}
            </span>
          </div>
        )}

        {/* Affected models */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Affected note types
          </p>
          {issues.map((issue) => (
            <div key={issue.modelName} className="flex items-center gap-2 text-sm">
              {updated.has(issue.modelName) ? (
                <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              )}
              <span
                className={updated.has(issue.modelName) ? 'text-muted-foreground line-through' : ''}
              >
                {issue.modelName}
              </span>
              {!consolidated && !updated.has(issue.modelName) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-6 text-xs"
                  disabled={update.isPending}
                  onClick={() => handleUpdate(issue.modelName)}
                >
                  Apply
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Template editors */}
        {representative.staleTemplates.map((tmpl) => (
          <div key={tmpl.name} className="space-y-2">
            <h3 className="text-sm font-semibold border-b border-border pb-1">
              {tmpl.name} template{' '}
              <span className="font-normal text-muted-foreground">
                ({formatVersionRange(tmpl.currentVersion, representative.latestVersion)})
              </span>
            </h3>
            <TemplateEditor
              label="Front"
              current={tmpl.current.front}
              proposed={edits[tmpl.name]?.front ?? tmpl.proposed.front}
              onChange={(v) => updateEdit(tmpl.name, 'front', v)}
            />
            <TemplateEditor
              label="Back"
              current={tmpl.current.back}
              proposed={edits[tmpl.name]?.back ?? tmpl.proposed.back}
              onChange={(v) => updateEdit(tmpl.name, 'back', v)}
            />
          </div>
        ))}

        {/* CSS editor */}
        {representative.cssOutdated && representative.currentCss != null && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold border-b border-border pb-1">CSS</h3>
            <TemplateEditor
              label="Styling"
              current={representative.currentCss}
              proposed={cssEdit}
              onChange={setCssEdit}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function NoteTypeHealth() {
  const [showDetail, setShowDetail] = useState(false);
  const { data, isLoading } = useNoteTypeHealth();
  const prevCountRef = useRef(0);

  const issues = data?.issues ?? [];

  // Auto-show when issues first appear
  useEffect(() => {
    if (issues.length > 0 && prevCountRef.current === 0) {
      setShowDetail(true);
    }
    prevCountRef.current = issues.length;
  }, [issues.length]);

  if (isLoading || issues.length === 0) return null;

  if (showDetail) {
    return <HealthDetail issues={issues} onClose={() => setShowDetail(false)} />;
  }

  return (
    <button
      className="w-full bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 flex-shrink-0 flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
      onClick={() => setShowDetail(true)}
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <p className="text-xs text-amber-800 dark:text-amber-200 flex-1 font-medium">
        {issues.length} note type{issues.length > 1 ? 's' : ''} can be updated
        {issues[0]?.missingFields.length
          ? ` — new fields: ${issues[0]!.missingFields.join(', ')}`
          : ''}
      </p>
    </button>
  );
}
