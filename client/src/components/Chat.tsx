import { useEffect, useState } from 'react';
import { useChat } from '@/hooks/useChat';
import { useSettingsStore } from '@/hooks/useSettings';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function Chat() {
  const { messages, isStreaming, error, sendMessage } = useChat();
  const { settings } = useSettingsStore();
  const [sharedText, setSharedText] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as globalThis.CustomEvent<string>).detail;
      if (text) setSharedText(text);
    };
    window.addEventListener('sharedText', handler);
    return () => window.removeEventListener('sharedText', handler);
  }, []);

  useEffect(() => {
    if (sharedText && !isStreaming) {
      sendMessage(sharedText, settings.defaultDeck);
      setSharedText(null);
    }
  }, [sharedText, isStreaming, sendMessage, settings.defaultDeck]);

  const handleSend = (content: string, highlightedWords?: string[]) => {
    sendMessage(content, settings.defaultDeck, highlightedWords);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <MessageList messages={messages} isStreaming={isStreaming} />

      {error && <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">{error}</div>}

      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
