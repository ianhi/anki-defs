import { useState, useCallback, useRef } from 'react';
import { chatApi } from '@/lib/api';
import type { Message, CardPreview } from 'shared';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to track the current request ID and prevent duplicates
  const currentRequestRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (content: string, deck?: string, highlightedWords?: string[]) => {
      // Generate unique request ID
      const requestId = generateId();

      // Prevent duplicate calls (React StrictMode can double-invoke)
      if (currentRequestRef.current !== null) {
        console.log('[Chat] Ignoring duplicate request, already streaming');
        return;
      }
      currentRequestRef.current = requestId;

      setError(null);

      // Generate message IDs upfront
      const userMsgId = generateId();
      const assistantMsgId = generateId();

      // Add user message
      const userMessage: Message = {
        id: userMsgId,
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      try {
        for await (const event of chatApi.stream(content, deck, highlightedWords)) {
          // Check if this request was cancelled
          if (currentRequestRef.current !== requestId) {
            console.log('[Chat] Request cancelled, stopping stream');
            return;
          }

          if (event.type === 'text' && typeof event.data === 'string') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: msg.content + event.data } : msg
              )
            );
          } else if (event.type === 'card_preview') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      cardPreviews: [...(msg.cardPreviews || []), event.data as CardPreview],
                    }
                  : msg
              )
            );
          } else if (event.type === 'error') {
            setError(event.data as string);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        // Only clear if this is still the current request
        if (currentRequestRef.current === requestId) {
          setIsStreaming(false);
          currentRequestRef.current = null;
        }
      }
    },
    []
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    currentRequestRef.current = null;
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
  };
}
