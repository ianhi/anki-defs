import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Check, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from './ui/Button';
import { useNoteTypeHealth, useUpdateTemplates } from '@/hooks/useAnki';
import type { NoteTypeIssue, StaleTemplate } from 'shared';

function formatVersionRange(current: number | null, latest: number): string {
  if (current === null) return `unversioned → v${latest}`;
  return `v${current} → v${latest}`;
}

function DiffBlock({ current, proposed }: { current: string; proposed: string }) {
  const currentLines = current.split('\n');
  const proposedLines = proposed.split('\n');
  const currentSet = new Set(currentLines);
  const proposedSet = new Set(proposedLines);

  const removed = currentLines.filter((line) => !proposedSet.has(line));

  return (
    <pre className="p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-muted/50 rounded border border-border overflow-auto max-h-64">
      {proposedLines.map((line, i) => {
        const isNew = !currentSet.has(line);
        return (
          <div
            key={i}
            className={
              isNew
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                : 'text-muted-foreground'
            }
          >
            {isNew ? '+ ' : '  '}
            {line}
          </div>
        );
      })}
      {removed.map((line, i) => (
        <div
          key={`rm-${i}`}
          className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
        >
          - {line}
        </div>
      ))}
    </pre>
  );
}

function TemplateDiffs({
  templates,
  latestVersion,
}: {
  templates: StaleTemplate[];
  latestVersion: number;
}) {
  return (
    <div className="space-y-4">
      {templates.map((tmpl) => (
        <div key={tmpl.name} className="space-y-2">
          <h4 className="text-sm font-medium">
            {tmpl.name}{' '}
            <span className="text-muted-foreground font-normal">
              ({formatVersionRange(tmpl.currentVersion, latestVersion)})
            </span>
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Front</p>
              <DiffBlock current={tmpl.current.front} proposed={tmpl.proposed.front} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Back</p>
              <DiffBlock current={tmpl.current.back} proposed={tmpl.proposed.back} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Check if all issues have the same changes (same card type, same versions). */
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

/** Full-screen diff + update view */
function HealthDetail({ issues, onClose }: { issues: NoteTypeIssue[]; onClose: () => void }) {
  const update = useUpdateTemplates();
  const [updated, setUpdated] = useState<Set<string>>(new Set());
  const consolidated = issuesAreIdentical(issues);
  const representative = issues[0]!;
  const allUpdated = issues.every((i) => updated.has(i.modelName));

  const handleUpdate = (modelName: string) => {
    update.mutate(modelName, {
      onSuccess: () => setUpdated((prev) => new Set(prev).add(modelName)),
    });
  };

  const handleUpdateAll = () => {
    for (const issue of issues) {
      if (!updated.has(issue.modelName)) {
        handleUpdate(issue.modelName);
      }
    }
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
            {issues.length === 1 ? 'Update' : `Update All (${issues.length})`}
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md p-2">
          Updating templates forces a one-way sync in Anki. You will need to choose Upload or
          Download next time you sync.
        </p>

        {/* Summary of affected models */}
        <div className="space-y-1">
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
              {issue.missingFields.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  +{issue.missingFields.join(', ')}
                </span>
              )}
              {!consolidated && !updated.has(issue.modelName) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-6 text-xs"
                  disabled={update.isPending}
                  onClick={() => handleUpdate(issue.modelName)}
                >
                  Update
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Template diffs — show once if consolidated, per-issue otherwise */}
        {consolidated ? (
          <>
            {representative.staleTemplates.length > 0 && (
              <TemplateDiffs
                templates={representative.staleTemplates}
                latestVersion={representative.latestVersion}
              />
            )}
            {representative.cssOutdated &&
              representative.currentCss &&
              representative.proposedCss && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">CSS</h4>
                  <DiffBlock
                    current={representative.currentCss}
                    proposed={representative.proposedCss}
                  />
                </div>
              )}
          </>
        ) : (
          issues.map((issue) => (
            <div key={issue.modelName} className="space-y-3">
              <h3 className="text-sm font-semibold border-b border-border pb-1">
                {issue.modelName}
              </h3>
              {issue.staleTemplates.length > 0 && (
                <TemplateDiffs
                  templates={issue.staleTemplates}
                  latestVersion={issue.latestVersion}
                />
              )}
              {issue.cssOutdated && issue.currentCss && issue.proposedCss && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">CSS</h4>
                  <DiffBlock current={issue.currentCss} proposed={issue.proposedCss} />
                </div>
              )}
            </div>
          ))
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

  // Auto-show detail view when issues first appear
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

  // Banner — click anywhere to open the full-screen detail
  return (
    <button
      className="w-full bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 flex-shrink-0 flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
      onClick={() => setShowDetail(true)}
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">
        {issues.length} note type{issues.length > 1 ? 's' : ''} can be updated with new features
        {issues[0]?.missingFields.length ? ` (${issues[0]!.missingFields.join(', ')})` : ''}
      </p>
    </button>
  );
}
