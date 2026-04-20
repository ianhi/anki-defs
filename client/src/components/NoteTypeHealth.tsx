import { useState } from 'react';
import { AlertTriangle, Check, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';
import { ankiApi } from '@/lib/api';
import { useNoteTypeHealth, useUpdateTemplates } from '@/hooks/useAnki';
import type { NoteTypeIssue, StaleTemplate } from 'shared';

function formatVersionRange(current: number | null, latest: number): string {
  if (current === null) return `unversioned → v${latest}`;
  return `v${current} → v${latest}`;
}

/** Syntax-highlight a single line of Anki template */
function highlightLine(text: string): React.ReactNode[] {
  const parts = text.split(/(<!--.*?-->|\{\{[^}]*\}\}|<\/?[a-zA-Z][^>]*>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<!--')) {
      return (
        <span key={i} className="text-emerald-600 dark:text-emerald-400">
          {part}
        </span>
      );
    }
    if (part.startsWith('{{')) {
      return (
        <span key={i} className="text-blue-600 dark:text-blue-400 font-semibold">
          {part}
        </span>
      );
    }
    if (part.startsWith('<')) {
      return (
        <span key={i} className="text-orange-600 dark:text-orange-400">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** Render template with syntax highlighting + line-level diff coloring */
function highlightWithDiff(
  text: string,
  otherLines: Set<string>,
  mode: 'added' | 'removed'
): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    const isDiff = !otherLines.has(line);
    const bg = isDiff
      ? mode === 'added'
        ? 'bg-green-100/70 dark:bg-green-900/20'
        : 'bg-red-100/70 dark:bg-red-900/20 line-through opacity-70'
      : '';
    return (
      <div key={i} className={bg}>
        {highlightLine(line)}
      </div>
    );
  });
}

/** Side-by-side current vs editable merged template */
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
  const [merging, setMerging] = useState(false);
  const hasUserChanges = current.trim() !== '' && current.trim() !== proposed.trim();

  const handleAIMerge = async () => {
    setMerging(true);
    try {
      const result = await ankiApi.mergeTemplates(current, proposed);
      onChange(result.merged);
    } catch {
      // Silently fail — user can still edit manually
    } finally {
      setMerging(false);
    }
  };

  const proposedLines = new Set(proposed.split('\n'));
  const currentLines = new Set(current.split('\n'));

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">
            Current
          </p>
          <pre className="p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-muted rounded border border-border">
            {current ? (
              highlightWithDiff(current, proposedLines, 'removed')
            ) : (
              <span className="italic text-muted-foreground">(empty)</span>
            )}
          </pre>
        </div>
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Merged result (editable)
            </p>
            {hasUserChanges && (
              <Button
                size="sm"
                variant="ghost"
                className="h-5 text-[10px] gap-1 text-primary"
                disabled={merging}
                onClick={handleAIMerge}
              >
                {merging ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                AI Merge
              </Button>
            )}
          </div>
          <div className="relative">
            <pre
              className="p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-muted rounded border border-border pointer-events-none"
              aria-hidden
            >
              {highlightWithDiff(proposed, currentLines, 'added')}
              {'\n'}
            </pre>
            <textarea
              className="absolute inset-0 w-full h-full p-2 text-[11px] font-mono leading-relaxed bg-transparent text-transparent caret-foreground rounded border border-transparent resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              value={proposed}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
            />
          </div>
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
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-medium">Review Template Updates</h2>
          <p className="text-xs text-muted-foreground">Nothing changes until you click apply</p>
        </div>
        {allUpdated ? (
          <Button variant="outline" onClick={onClose}>
            <Check className="h-4 w-4 mr-1.5 text-green-500" />
            Done
          </Button>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Dismiss
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-5 max-w-5xl mx-auto w-full">
        <div className="text-xs text-muted-foreground bg-muted rounded-md p-2.5 space-y-1">
          <p>
            Review the changes below. The <strong>merged result</strong> on the right is what will
            be applied — you can edit it freely or use <strong>AI Merge</strong> to automatically
            combine your customizations with the new features.
          </p>
          <p className="text-amber-700 dark:text-amber-300">
            Applying will update your Anki note types and force a one-way sync.
          </p>
        </div>

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

        {/* Apply button — at the bottom after the user has reviewed everything */}
        {!allUpdated && (
          <div className="border-t border-border pt-4 flex items-center gap-3">
            <Button disabled={update.isPending} onClick={handleUpdateAll}>
              {update.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {issues.length === 1 ? 'Apply to Anki' : `Apply to All ${issues.length} Note Types`}
            </Button>
            <p className="text-xs text-muted-foreground">Uses the merged result shown above</p>
          </div>
        )}
      </div>
    </div>
  );
}

const DISMISSED_KEY = 'noteTypeHealth:dismissed';

function getDismissedVersions(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}');
  } catch {
    return {};
  }
}

function dismissVersions(issues: NoteTypeIssue[]) {
  const dismissed = getDismissedVersions();
  for (const issue of issues) {
    dismissed[issue.modelName] = issue.latestVersion;
  }
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
}

function filterDismissed(issues: NoteTypeIssue[]): NoteTypeIssue[] {
  const dismissed = getDismissedVersions();
  return issues.filter((issue) => {
    const ver = dismissed[issue.modelName];
    // Show if: never dismissed, or new version available, or has missing fields
    return ver == null || ver < issue.latestVersion || issue.missingFields.length > 0;
  });
}

export function NoteTypeHealth() {
  const [showDetail, setShowDetail] = useState(false);
  const { data, isLoading } = useNoteTypeHealth();

  const allIssues = data?.issues ?? [];
  const issues = filterDismissed(allIssues);

  if (isLoading || issues.length === 0) return null;

  const handleClose = () => {
    setShowDetail(false);
    dismissVersions(issues);
  };

  if (showDetail) {
    return <HealthDetail issues={issues} onClose={handleClose} />;
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
