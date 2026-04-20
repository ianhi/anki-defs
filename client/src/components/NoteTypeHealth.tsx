import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Check, X, Loader2, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useNoteTypeHealth, useUpdateTemplates } from '@/hooks/useAnki';
import type { NoteTypeIssue, StaleTemplate } from 'shared';

function formatVersionRange(current: number | null, latest: number): string {
  if (current === null) return `no version → v${latest}`;
  return `v${current} → v${latest}`;
}

function SimpleDiff({
  current,
  proposed,
  label,
}: {
  current: string;
  proposed: string;
  label: string;
}) {
  const currentLines = current.split('\n');
  const proposedLines = proposed.split('\n');
  const currentSet = new Set(currentLines);
  const proposedSet = new Set(proposedLines);

  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium text-muted-foreground py-1">{label}</summary>
      <div className="mt-1 rounded border border-border overflow-auto max-h-48">
        <pre className="p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all">
          {proposedLines.map((line, i) => {
            const isNew = !currentSet.has(line);
            return (
              <div
                key={i}
                className={
                  isNew
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : ''
                }
              >
                {isNew ? '+ ' : '  '}
                {line}
              </div>
            );
          })}
          {currentLines
            .filter((line) => !proposedSet.has(line))
            .map((line, i) => (
              <div
                key={`rm-${i}`}
                className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
              >
                - {line}
              </div>
            ))}
        </pre>
      </div>
    </details>
  );
}

function TemplateDiff({ tmpl, latestVersion }: { tmpl: StaleTemplate; latestVersion: number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">
        {tmpl.name} ({formatVersionRange(tmpl.currentVersion, latestVersion)})
      </p>
      <SimpleDiff
        current={tmpl.current.front}
        proposed={tmpl.proposed.front}
        label="Front template"
      />
      <SimpleDiff current={tmpl.current.back} proposed={tmpl.proposed.back} label="Back template" />
    </div>
  );
}

function IssueDetail({
  issue,
  onUpdateSuccess,
}: {
  issue: NoteTypeIssue;
  onUpdateSuccess: () => void;
}) {
  const update = useUpdateTemplates();
  const [showPreview, setShowPreview] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);

  const handleUpdate = () => {
    update.mutate(issue.modelName, { onSuccess: onUpdateSuccess });
    setConfirmUpdate(false);
  };

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{issue.modelName}</p>
          <p className="text-xs text-muted-foreground">{issue.cardType} card</p>
        </div>
        {update.isSuccess ? (
          <Badge variant="default" className="bg-green-600 text-white">
            <Check className="h-3 w-3 mr-1" /> Updated
          </Badge>
        ) : (
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="h-3 w-3 mr-1" />
              {showPreview ? 'Hide' : 'Preview'}
            </Button>
            {confirmUpdate ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={update.isPending}
                  onClick={handleUpdate}
                >
                  {update.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmUpdate(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmUpdate(true)}>
                Update
              </Button>
            )}
          </div>
        )}
      </div>

      <ul className="text-xs text-muted-foreground space-y-1">
        {issue.missingFields.length > 0 && (
          <li>
            Missing fields: <span className="font-medium">{issue.missingFields.join(', ')}</span>
          </li>
        )}
        {issue.staleTemplates.length > 0 && (
          <li>
            {issue.staleTemplates.length} template{issue.staleTemplates.length > 1 ? 's' : ''}{' '}
            outdated
          </li>
        )}
        {issue.cssOutdated && <li>CSS outdated</li>}
      </ul>

      {confirmUpdate && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          This will overwrite templates with the latest version and force a one-way sync.
        </p>
      )}

      {showPreview && (
        <div className="space-y-2 pt-1 border-t border-border">
          {issue.staleTemplates.map((tmpl) => (
            <TemplateDiff key={tmpl.name} tmpl={tmpl} latestVersion={issue.latestVersion} />
          ))}
          {issue.cssOutdated && issue.currentCss && issue.proposedCss && (
            <SimpleDiff current={issue.currentCss} proposed={issue.proposedCss} label="CSS" />
          )}
        </div>
      )}
    </div>
  );
}

export function NoteTypeHealth() {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useNoteTypeHealth();
  const prevCountRef = useRef(0);

  const issues = data?.issues ?? [];

  // Auto-expand banner when issues first appear
  useEffect(() => {
    if (issues.length > 0 && prevCountRef.current === 0) {
      setDismissed(false);
    }
    prevCountRef.current = issues.length;
  }, [issues.length]);

  if (isLoading || issues.length === 0) return null;

  // Compact icon mode (after user dismisses the banner)
  if (dismissed) {
    return (
      <div className="px-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-amber-600 dark:text-amber-400 text-xs gap-1.5 h-7"
          onClick={() => setDismissed(false)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {issues.length} note type update{issues.length > 1 ? 's' : ''} available
        </Button>
      </div>
    );
  }

  // Prominent banner mode
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 flex-shrink-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">
          {issues.length} note type{issues.length > 1 ? 's' : ''} can be updated with new features
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 text-amber-600"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 text-amber-600"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {issues.map((issue) => (
            <IssueDetail key={issue.modelName} issue={issue} onUpdateSuccess={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}
