import { useState } from 'react';
import { AlertTriangle, Check, X, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useNoteTypeHealth, useUpdateTemplates } from '@/hooks/useAnki';
import type { NoteTypeIssue } from 'shared';

function formatVersionRange(current: number | null, latest: number): string {
  if (current === null) return `no version \u2192 v${latest}`;
  return `v${current} \u2192 v${latest}`;
}

function IssueDetail({ issue }: { issue: NoteTypeIssue }) {
  const update = useUpdateTemplates();

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{issue.modelName}</p>
          <p className="text-xs text-muted-foreground">{issue.cardType} card</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() => update.mutate(issue.modelName)}
        >
          {update.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : update.isSuccess ? (
            <Check className="h-3 w-3 mr-1 text-green-500" />
          ) : null}
          {update.isSuccess ? 'Updated' : 'Update'}
        </Button>
      </div>

      <ul className="text-xs text-muted-foreground space-y-1">
        {issue.missingFields.length > 0 && (
          <li>
            {issue.missingFields.length} missing field{issue.missingFields.length > 1 ? 's' : ''}:{' '}
            {issue.missingFields.join(', ')}
          </li>
        )}
        {issue.staleTemplates.length > 0 && (
          <li>
            Templates outdated:{' '}
            {issue.staleTemplates
              .map(
                (t) => `${t.name} (${formatVersionRange(t.currentVersion, issue.latestVersion)})`
              )
              .join(', ')}
          </li>
        )}
        {issue.cssOutdated && <li>CSS outdated</li>}
      </ul>
    </div>
  );
}

export function NoteTypeHealth() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useNoteTypeHealth();
  const update = useUpdateTemplates();

  if (isLoading || !data || data.issues.length === 0) return null;

  const issues = data.issues;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title={`${issues.length} note type issue${issues.length > 1 ? 's' : ''}`}
      >
        <div className="relative">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center">
            {issues.length}
          </span>
        </div>
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-card rounded-lg shadow-lg w-full max-w-md border border-border flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h2 className="font-medium text-sm">Note Type Issues</h2>
                <Badge variant="warning">{issues.length}</Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md p-2">
                Updating templates forces a one-way sync in Anki.
              </p>

              {issues.length > 1 && (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={update.isPending}
                  onClick={() => {
                    for (const issue of issues) {
                      update.mutate(issue.modelName);
                    }
                  }}
                >
                  {update.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Update All
                </Button>
              )}

              {issues.map((issue) => (
                <IssueDetail key={issue.modelName} issue={issue} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
