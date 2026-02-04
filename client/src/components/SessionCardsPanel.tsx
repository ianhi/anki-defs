import { useSessionCards } from '@/hooks/useSessionCards';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Trash2, Check } from 'lucide-react';
import { Button } from './ui/Button';

export function SessionCardsPanel() {
  const { cards, removeCard, clearCards } = useSessionCards();

  if (cards.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p className="text-sm">No cards created yet this session.</p>
        <p className="text-xs mt-1">Cards you create will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-sm font-medium">Session Cards ({cards.length})</span>
        <Button variant="ghost" size="sm" onClick={clearCards}>
          Clear
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {cards.map((card) => (
          <Card key={card.id} className="relative">
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{card.word}</CardTitle>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    Added
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeCard(card.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <p className="text-sm text-muted-foreground">{card.definition}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
