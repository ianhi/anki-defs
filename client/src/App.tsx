import { useState } from 'react';
import { Chat } from './components/Chat';
import { Settings } from './components/Settings';
import { HeaderDeckSelector, MobileDeckSelector } from './components/HeaderDeckSelector';
import { SessionCardsPanel } from './components/SessionCardsPanel';
import { RetryUxDemo } from './components/RetryUxDemo';
import { PromptPreview } from './components/PromptPreview';
import { HistoryPanel } from './components/HistoryPanel';
import { TokenDisplay } from './components/TokenDisplay';
import { SettingsIcon, X, Layers, RefreshCw, History } from 'lucide-react';
import { Button } from './components/ui/Button';
import { useSessionCards } from './hooks/useSessionCards';
import { useTokenUsage } from './hooks/useTokenUsage';
import { useAnkiSync, useAnkiStatus } from './hooks/useAnki';
import { usePlatform } from './hooks/usePlatform';

// Check for demo mode via URL search params
const demoParam = new URLSearchParams(window.location.search).get('demo');

export default function App() {
  if (demoParam === 'retry') {
    return <RetryUxDemo />;
  }
  if (demoParam === 'prompts') {
    return <PromptPreview />;
  }

  return <MainApp />;
}

function MainApp() {
  const [showSettings, setShowSettings] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { cards, pendingQueue } = useSessionCards();
  const totalCards = cards.length + pendingQueue.length;
  const { totalInputTokens, totalOutputTokens, totalCost, reset: resetUsage } = useTokenUsage();
  const totalTokens = totalInputTokens + totalOutputTokens;
  const platform = usePlatform();
  const isAndroid = platform.platform === 'android';
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
              <TokenDisplay
                totalTokens={totalTokens}
                totalInputTokens={totalInputTokens}
                totalOutputTokens={totalOutputTokens}
                totalCost={totalCost}
                onReset={resetUsage}
              />
            )}
            {!isAndroid && ankiConnected && (
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
              variant={showHistory ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
              title="Word history"
            >
              <History className="h-4 w-4" />
            </Button>
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

      {/* History Sidebar - overlay on mobile, sidebar on desktop */}
      {showHistory && (
        <aside className="fixed inset-0 z-40 bg-card sm:static sm:inset-auto sm:w-72 sm:border-l sm:border-border flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-medium">Word History</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowHistory(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <HistoryPanel />
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
