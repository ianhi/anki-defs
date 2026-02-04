import { useState } from 'react';
import { Chat } from './components/Chat';
import { Settings } from './components/Settings';
import { HeaderDeckSelector } from './components/HeaderDeckSelector';
import { SessionCardsPanel } from './components/SessionCardsPanel';
import { SettingsIcon, X, Layers } from 'lucide-react';
import { Button } from './components/ui/Button';
import { useSessionCards } from './hooks/useSessionCards';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const { cards, pendingQueue } = useSessionCards();
  const totalCards = cards.length + pendingQueue.length;

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Bangla Vocabulary</h1>
            <HeaderDeckSelector />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={showCards ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowCards(!showCards)}
              className="gap-2"
            >
              <Layers className="h-4 w-4" />
              {totalCards > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    pendingQueue.length > 0
                      ? 'bg-orange-500 text-white'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {totalCards}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
              {showSettings ? <X className="h-5 w-5" /> : <SettingsIcon className="h-5 w-5" />}
            </Button>
          </div>
        </header>
        <Chat />
      </div>

      {/* Cards Sidebar */}
      {showCards && (
        <aside className="w-72 border-l border-border bg-card flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-medium">Session Cards</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowCards(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <SessionCardsPanel />
        </aside>
      )}

      {/* Settings Sidebar */}
      {showSettings && (
        <aside className="w-80 border-l border-border bg-card overflow-y-auto">
          <Settings />
        </aside>
      )}
    </div>
  );
}
