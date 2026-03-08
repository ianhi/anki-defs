import { useCallback, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { chatApi } from '@/lib/api';
import { generateId } from '@/lib/utils';
import { parseHighlightedWords, getCleanText } from '@/lib/focus';
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
    async (content: string, deck?: string, userContext?: string) => {
      const requestId = generateId();

      if (currentRequestRef.current !== null) {
        console.log('[Chat] Ignoring duplicate request, already streaming');
        return;
      }
      currentRequestRef.current = requestId;

      setError(null);

      // content has ** markers — extract highlighted words for API, keep raw for display
      const highlightedWords = parseHighlightedWords(content);
      const cleanText = getCleanText(content);

      const userMsgId = generateId();
      const assistantMsgId = generateId();

      const userMessage: Message = {
        id: userMsgId,
        role: 'user',
        content, // Raw text with ** markers — source of truth for display
        timestamp: Date.now(),
      };

      const assistantMessage: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        originalQuery: cleanText,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      try {
        // Send clean text + extracted words to API
        const apiHighlightedWords = highlightedWords.length > 0 ? highlightedWords : undefined;
        for await (const event of chatApi.stream(
          cleanText,
          deck,
          apiHighlightedWords,
          userContext
        )) {
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

      // Find preceding user message to get original query and highlighted words
      let originalQuery = assistantMsg.originalQuery;
      let retryHighlightedWords: string[] | undefined;
      const assistantIdx = msgs.indexOf(assistantMsg);
      for (let i = assistantIdx - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m && m.role === 'user') {
          if (!originalQuery) originalQuery = getCleanText(m.content);
          const hw = parseHighlightedWords(m.content);
          if (hw.length > 0) retryHighlightedWords = hw;
          break;
        }
      }
      if (!originalQuery) return;

      const refinements = [...(assistantMsg.refinements || []), context];

      // Send all accumulated refinements as structured userContext
      const userContext = refinements.join('; ');

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
        for await (const event of chatApi.stream(
          originalQuery,
          settings.defaultDeck,
          retryHighlightedWords,
          userContext
        )) {
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
