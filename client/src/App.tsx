import { useState } from 'react';
import { Chat } from './components/Chat';
import { Settings } from './components/Settings';
import { HeaderDeckSelector, MobileDeckSelector } from './components/HeaderDeckSelector';
import { SessionCardsPanel } from './components/SessionCardsPanel';
import { SettingsIcon, X, Layers, RefreshCw } from 'lucide-react';
import { Button } from './components/ui/Button';
import { useSessionCards } from './hooks/useSessionCards';
import { useTokenUsage } from './hooks/useTokenUsage';
import { useAnkiSync, useAnkiStatus } from './hooks/useAnki';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const { cards, pendingQueue } = useSessionCards();
  const totalCards = cards.length + pendingQueue.length;
  const { totalInputTokens, totalOutputTokens, totalCost, reset: resetUsage } = useTokenUsage();
  const totalTokens = totalInputTokens + totalOutputTokens;
  const sync = useAnkiSync();
  const { data: ankiConnected } = useAnkiStatus();

  return (
    <div className="fixed inset-0 flex overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 border-b border-border bg-background gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold whitespace-nowrap">Bangla</h1>
            <div className="sm:hidden">
              <MobileDeckSelector />
            </div>
            <div className="hidden sm:block">
              <HeaderDeckSelector />
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {totalTokens > 0 && (
              <button
                className="text-xs text-muted-foreground mr-1 sm:mr-2 tabular-nums hover:text-foreground transition-colors hidden sm:block"
                title={`Input: ${totalInputTokens.toLocaleString()} | Output: ${totalOutputTokens.toLocaleString()}\nClick to reset`}
                onClick={resetUsage}
              >
                {totalTokens.toLocaleString()} tok
                {totalCost > 0 &&
                  ` · $${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(2)}`}
              </button>
            )}
            {ankiConnected && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
                title="Sync Anki"
              >
                <RefreshCw
                  className={`h-4 w-4 ${sync.isPending ? 'animate-spin' : ''} ${sync.isSuccess ? 'text-green-500' : ''} ${sync.isError ? 'text-destructive' : ''}`}
                />
              </Button>
            )}
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

      {/* Cards Sidebar - overlay on mobile, sidebar on desktop */}
      {showCards && (
        <aside className="fixed inset-0 z-40 bg-card sm:static sm:inset-auto sm:w-72 sm:border-l sm:border-border flex flex-col">
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

      {/* Settings Sidebar - overlay on mobile, sidebar on desktop */}
      {showSettings && (
        <aside className="fixed inset-0 z-40 bg-card overflow-y-auto sm:static sm:inset-auto sm:w-80 sm:border-l sm:border-border">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sm:hidden">
            <h2 className="font-medium">Settings</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowSettings(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Settings />
        </aside>
      )}
    </div>
  );
}
