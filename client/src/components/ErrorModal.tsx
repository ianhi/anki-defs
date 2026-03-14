import { useState } from 'react';
import { useErrorModal } from '@/hooks/useErrorModal';
import { Button } from './ui/Button';
import { X, Copy, Check } from 'lucide-react';

export function ErrorModal() {
  const { error, clearError } = useErrorModal();
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const debugInfo = JSON.stringify(
    {
      error: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: window.navigator.userAgent,
    },
    null,
    2
  );

  const handleCopy = async () => {
    await window.navigator.clipboard.writeText(debugInfo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) clearError();
      }}
    >
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md border border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-medium text-destructive">{error.title}</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearError}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm">{error.message}</p>
          {error.details && (
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-32 whitespace-pre-wrap break-words">
              {error.details}
            </pre>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy debug info
                </>
              )}
            </Button>
            <Button size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
