import { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { loadPdf, extractOutline, type ExtractedOutline } from '@/lib/pdf';

function filenameSlug(name: string): string {
  return name
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

interface Props {
  onReady: (outline: ExtractedOutline, sourceTag: string) => void;
}

export function PdfUploadStep({ onReady }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      setProgress('Loading PDF…');
      const doc = await loadPdf(file);
      setProgress(`Extracting outline from ${doc.numPages} pages…`);
      const outline = await extractOutline(doc);
      onReady(outline, `pdf:${filenameSlug(file.name)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PDF');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a PDF with selectable text. We&apos;ll extract the outline and ask an AI scout to
        classify sections before you pick which ones to turn into cards.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={loading}>
        {loading ? 'Working…' : 'Choose PDF'}
      </Button>
      {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
