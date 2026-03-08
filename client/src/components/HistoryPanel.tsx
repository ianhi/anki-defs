import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sessionApi } from '@/lib/api';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Search } from 'lucide-react';

export function HistoryPanel() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['history', debouncedQuery],
    queryFn: () => sessionApi.getHistory({ q: debouncedQuery || undefined, limit: 50 }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search history..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          <p className="text-sm">
            {debouncedQuery ? 'No matching words found.' : 'No history yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
            {total} word{total !== 1 ? 's' : ''}
            {debouncedQuery ? ` matching "${debouncedQuery}"` : ' total'}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {items.map((card) => (
              <Card key={card.id}>
                <CardHeader className="pb-1 pt-2.5 px-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{card.word}</CardTitle>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
                      {new Date(card.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-2.5 pt-0">
                  <p className="text-sm text-muted-foreground">{card.definition}</p>
                  {card.banglaDefinition && (
                    <p className="text-sm text-muted-foreground/70 mt-0.5">
                      {card.banglaDefinition}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
