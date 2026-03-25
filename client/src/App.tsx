import { useState, useEffect } from 'react';
import { Chat } from './components/Chat';
import { Settings } from './components/Settings';
import { OnboardingModal } from './components/OnboardingModal';
import { HelpPage } from './components/HelpPage';
import { HeaderDeckSelector } from './components/HeaderDeckSelector';
import { RetryUxDemo } from './components/RetryUxDemo';
import { PromptPreview } from './components/PromptPreview';
import { HistoryPanel } from './components/HistoryPanel';
import { TokenDisplay } from './components/TokenDisplay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorModal } from './components/ErrorModal';
import { SettingsIcon, X, RefreshCw, History, AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from './components/ui/Button';
import { useSessionCards, initSessionCards } from './hooks/useSessionCards';
import { useSettingsStore } from './hooks/useSettings';
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

function needsOnboarding(settings: {
  aiProvider: string;
  claudeApiKey: string;
  geminiApiKey: string;
  openRouterApiKey: string;
}): boolean {
  if (localStorage.getItem('anki-defs-onboarded')) return false;
  const keyForProvider =
    settings.aiProvider === 'claude'
      ? settings.claudeApiKey
      : settings.aiProvider === 'gemini'
        ? settings.geminiApiKey
        : settings.openRouterApiKey;
  return !keyForProvider;
}

function MainApp() {
  useEffect(() => initSessionCards(), []);

  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { pendingQueue } = useSessionCards();
  const { settings } = useSettingsStore();
  const { totalInputTokens, totalOutputTokens, totalCost, reset: resetUsage } = useTokenUsage();
  const totalTokens = totalInputTokens + totalOutputTokens;
  const platform = usePlatform();
  const isAndroid = platform.platform === 'android';
  const sync = useAnkiSync();
  const { data: ankiConnected } = useAnkiStatus();

  // Show onboarding on first visit when no API key is configured
  useEffect(() => {
    if (needsOnboarding(settings)) {
      setShowOnboarding(true);
    }
  }, [settings]);

  return (
    <div className="fixed inset-0 flex overflow-hidden h-dvh">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 border-b border-border bg-background gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <span className="text-xs text-muted-foreground hidden sm:inline">Deck</span>
            <HeaderDeckSelector />
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
            {!isAndroid && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => sync.mutate()}
                disabled={sync.isPending || !ankiConnected}
                title="Sync Anki"
                className={ankiConnected ? '' : 'invisible'}
              >
                <RefreshCw
                  className={`h-4 w-4 ${sync.isPending ? 'animate-spin' : ''} ${sync.isSuccess ? 'text-green-500' : ''} ${sync.isError ? 'text-destructive' : ''}`}
                />
              </Button>
            )}
            {pendingQueue.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(true)}
                title={`${pendingQueue.length} card${pendingQueue.length > 1 ? 's' : ''} queued — waiting for Anki`}
              >
                <AlertTriangle className="h-4 w-4 text-orange-500" />
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
            <Button variant="ghost" size="icon" onClick={() => setShowHelp(true)} title="Help">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
              {showSettings ? <X className="h-5 w-5" /> : <SettingsIcon className="h-5 w-5" />}
            </Button>
          </div>
        </header>
        <ErrorBoundary>
          <Chat />
        </ErrorBoundary>
      </div>

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

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <div className="bg-card rounded-lg shadow-lg w-full max-w-5xl border border-border flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
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
          </div>
        </div>
      )}
      {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}
      {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}
      <ErrorModal />
    </div>
  );
}
