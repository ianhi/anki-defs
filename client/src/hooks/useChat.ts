import { useCallback, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { chatApi } from '@/lib/api';
import type { Message, CardPreview, TokenUsage } from 'shared';
import { useTokenUsage } from './useTokenUsage';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  setMessages: (updater: Message[] | ((prev: Message[]) => Message[])) => void;
  setIsStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
}

const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isStreaming: false,
      error: null,
      setMessages: (updater) =>
        set((state) => ({
          messages: typeof updater === 'function' ? updater(state.messages) : updater,
        })),
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),
      setError: (error) => set({ error }),
      clearMessages: () => set({ messages: [], error: null }),
    }),
    {
      name: 'bangla-chat',
      partialize: (state) => ({
        messages: state.messages,
      }),
    }
  )
);

export function useChat() {
  const { messages, isStreaming, error, setMessages, setIsStreaming, setError, clearMessages } =
    useChatStore();

  const currentRequestRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (content: string, deck?: string, highlightedWords?: string[]) => {
      const requestId = generateId();

      if (currentRequestRef.current !== null) {
        console.log('[Chat] Ignoring duplicate request, already streaming');
        return;
      }
      currentRequestRef.current = requestId;

      setError(null);

      const userMsgId = generateId();
      const assistantMsgId = generateId();

      const userMessage: Message = {
        id: userMsgId,
        role: 'user',
        content,
        timestamp: Date.now(),
        highlightedWords,
      };

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
          } else if (event.type === 'usage') {
            const usage = event.data as TokenUsage;
            useTokenUsage.getState().addUsage(usage);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, tokenUsage: usage } : msg
              )
            );
          } else if (event.type === 'error') {
            setError(event.data as string);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        if (currentRequestRef.current === requestId) {
          setIsStreaming(false);
          currentRequestRef.current = null;
        }
      }
    },
    [setMessages, setIsStreaming, setError]
  );

  const clearChat = useCallback(() => {
    clearMessages();
    currentRequestRef.current = null;
  }, [clearMessages]);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages: clearChat,
  };
}
