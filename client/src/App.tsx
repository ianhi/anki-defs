import { useState } from 'react';
import { Chat } from './components/Chat';
import { Settings } from './components/Settings';
import { SettingsIcon, X } from 'lucide-react';
import { Button } from './components/ui/Button';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h1 className="text-xl font-semibold">Bangla Vocabulary</h1>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? <X className="h-5 w-5" /> : <SettingsIcon className="h-5 w-5" />}
          </Button>
        </header>
        <Chat />
      </div>

      {/* Settings Sidebar */}
      {showSettings && (
        <aside className="w-80 border-l border-border bg-card overflow-y-auto">
          <Settings />
        </aside>
      )}
    </div>
  );
}
