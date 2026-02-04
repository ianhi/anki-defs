import { useChat } from '@/hooks/useChat';
import { useSettingsStore } from '@/hooks/useSettings';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function Chat() {
  const { messages, isStreaming, error, sendMessage } = useChat();
  const { settings } = useSettingsStore();

  const handleSend = (content: string) => {
    sendMessage(content, settings.defaultDeck);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <MessageList messages={messages} isStreaming={isStreaming} />

      {error && <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">{error}</div>}

      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
