import { useCallback, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { chatApi } from '@/lib/api';
import { generateId } from '@/lib/utils';
import type { Message } from 'shared';
import { useTokenUsage } from './useTokenUsage';

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
        originalQuery: content,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      try {
        for await (const event of chatApi.stream(content, deck, highlightedWords)) {
          if (currentRequestRef.current !== requestId) {
            console.log('[Chat] Request cancelled, stopping stream');
            return;
          }

          switch (event.type) {
            case 'text':
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: msg.content + event.data } : msg
                )
              );
              break;
            case 'card_preview':
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        cardPreviews: [...(msg.cardPreviews || []), event.data],
                      }
                    : msg
                )
              );
              break;
            case 'usage':
              useTokenUsage.getState().addUsage(event.data);
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== assistantMsgId) return msg;
                  const existing = msg.tokenUsage;
                  if (existing) {
                    return {
                      ...msg,
                      tokenUsage: {
                        ...existing,
                        inputTokens: existing.inputTokens + event.data.inputTokens,
                        outputTokens: existing.outputTokens + event.data.outputTokens,
                      },
                    };
                  }
                  return { ...msg, tokenUsage: event.data };
                })
              );
              break;
            case 'error':
              setError(event.data);
              break;
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

  const retryWithContext = useCallback(
    async (assistantMsgId: string, context: string) => {
      if (currentRequestRef.current !== null) {
        console.log('[Chat] Ignoring retry, already streaming');
        return;
      }

      const requestId = generateId();
      currentRequestRef.current = requestId;
      setError(null);

      // Find the assistant message and the preceding user message
      const msgs = useChatStore.getState().messages;
      const assistantMsg = msgs.find((m) => m.id === assistantMsgId);
      if (!assistantMsg) return;

      // Find preceding user message to get original query
      let originalQuery = assistantMsg.originalQuery;
      if (!originalQuery) {
        const assistantIdx = msgs.indexOf(assistantMsg);
        for (let i = assistantIdx - 1; i >= 0; i--) {
          const m = msgs[i];
          if (m && m.role === 'user') {
            originalQuery = m.content;
            break;
          }
        }
      }
      if (!originalQuery) return;

      const refinements = [...(assistantMsg.refinements || []), context];

      // Build the re-query with all accumulated context
      const contextLines = refinements.map((r) => `(Context: ${r})`).join('\n');
      const reQuery = `${originalQuery}\n${contextLines}`;

      // Reset the assistant message and add refinement
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: '',
                cardPreviews: undefined,
                tokenUsage: undefined,
                refinements,
                originalQuery,
              }
            : msg
        )
      );
      setIsStreaming(true);

      const { settings } = await import('@/hooks/useSettings').then((m) => ({
        settings: m.useSettingsStore.getState().settings,
      }));

      try {
        for await (const event of chatApi.stream(reQuery, settings.defaultDeck)) {
          if (currentRequestRef.current !== requestId) {
            console.log('[Chat] Retry cancelled, stopping stream');
            return;
          }

          switch (event.type) {
            case 'text':
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: msg.content + event.data } : msg
                )
              );
              break;
            case 'card_preview':
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        cardPreviews: [...(msg.cardPreviews || []), event.data],
                      }
                    : msg
                )
              );
              break;
            case 'usage':
              useTokenUsage.getState().addUsage(event.data);
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== assistantMsgId) return msg;
                  const existing = msg.tokenUsage;
                  if (existing) {
                    return {
                      ...msg,
                      tokenUsage: {
                        ...existing,
                        inputTokens: existing.inputTokens + event.data.inputTokens,
                        outputTokens: existing.outputTokens + event.data.outputTokens,
                      },
                    };
                  }
                  return { ...msg, tokenUsage: event.data };
                })
              );
              break;
            case 'error':
              setError(event.data);
              break;
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
    retryWithContext,
    clearMessages: clearChat,
  };
}
