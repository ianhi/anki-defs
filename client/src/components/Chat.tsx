import { useChat } from '@/hooks/useChat';
import { useSettingsStore } from '@/hooks/useSettings';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { DebugMenu } from './DebugMenu';

export function Chat() {
  const { messages, isStreaming, error, sendMessage } = useChat();
  const { settings } = useSettingsStore();

  const handleSend = (content: string, highlightedWords?: string[]) => {
    sendMessage(content, settings.defaultDeck, highlightedWords);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <MessageList messages={messages} isStreaming={isStreaming} />

      {error && <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">{error}</div>}

      <MessageInput onSend={handleSend} disabled={isStreaming} />

      {/* TODO: Remove debug menu before production */}
      <DebugMenu onSelectExample={handleSend} disabled={isStreaming} />
    </div>
  );
}
