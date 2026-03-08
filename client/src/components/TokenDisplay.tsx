import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

export function TokenDisplay({
  totalTokens,
  totalInputTokens,
  totalOutputTokens,
  totalCost,
  onReset,
}: {
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const costStr =
    totalCost > 0 ? `$${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(2)}` : null;

  return (
    <div className="relative mr-1 sm:mr-2 hidden sm:block">
      <button
        className="text-xs text-muted-foreground tabular-nums hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {totalTokens.toLocaleString()} tok{costStr && ` · ${costStr}`}
      </button>
      {expanded && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-3 text-xs tabular-nums min-w-[180px]">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Input</span>
              <span>{totalInputTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Output</span>
              <span>{totalOutputTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-medium border-t border-border pt-1.5">
              <span>Total</span>
              <span>{totalTokens.toLocaleString()}</span>
            </div>
            {costStr && (
              <div className="flex justify-between font-medium">
                <span>Cost</span>
                <span>{costStr}</span>
              </div>
            )}
          </div>
          <button
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors py-1 rounded border border-border hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
              setExpanded(false);
            }}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
