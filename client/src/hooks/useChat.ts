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
  const streamingRef = useRef(false);

  const sendMessage = useCallback(async (content: string, deck?: string) => {
    // Prevent duplicate calls (React StrictMode can double-invoke)
    if (streamingRef.current) {
      return;
    }
    streamingRef.current = true;

    setError(null);

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    setIsStreaming(true);

    try {
      for await (const event of chatApi.stream(content, deck)) {
        if (event.type === 'text' && typeof event.data === 'string') {
          setMessages((prev) => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content += event.data;
            }
            return updated;
          });
        } else if (event.type === 'card_preview') {
          setMessages((prev) => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.cardPreview = event.data as CardPreview;
            }
            return updated;
          });
        } else if (event.type === 'error') {
          setError(event.data as string);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsStreaming(false);
      streamingRef.current = false;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
  };
}
