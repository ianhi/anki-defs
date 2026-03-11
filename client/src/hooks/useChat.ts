import { useCallback, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { chatApi } from '@/lib/api';
import { generateId } from '@/lib/utils';
import { parseHighlightedWords, getCleanText } from '@/lib/focus';
import { useSettingsStore } from '@/hooks/useSettings';
import type { Message } from 'shared';
import { useTokenUsage } from './useTokenUsage';

interface ChatState {
  messages: Message[];
  activeStreamCount: number;
  error: string | null;
  setMessages: (updater: Message[] | ((prev: Message[]) => Message[])) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  incrementStreams: () => void;
  decrementStreams: () => void;
}

const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      activeStreamCount: 0,
      error: null,
      setMessages: (updater) =>
        set((state) => ({
          messages: typeof updater === 'function' ? updater(state.messages) : updater,
        })),
      setError: (error) => set({ error }),
      clearMessages: () => set({ messages: [], error: null, activeStreamCount: 0 }),
      incrementStreams: () => set((state) => ({ activeStreamCount: state.activeStreamCount + 1 })),
      decrementStreams: () =>
        set((state) => ({
          activeStreamCount: Math.max(0, state.activeStreamCount - 1),
        })),
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
  const {
    messages,
    activeStreamCount,
    error,
    setMessages,
    setError,
    clearMessages,
    incrementStreams,
    decrementStreams,
  } = useChatStore();

  const isStreaming = activeStreamCount > 0;

  // Track active AbortControllers for cancellation on clear
  const activeControllersRef = useRef(new Set<AbortController>());

  const sendMessage = useCallback(
    async (content: string, deck?: string, userContext?: string, mode?: 'english-to-bangla') => {
      const controller = new AbortController();

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
      incrementStreams();
      activeControllersRef.current.add(controller);

      try {
        // Send clean text + extracted words to API
        const apiHighlightedWords = highlightedWords.length > 0 ? highlightedWords : undefined;
        for await (const event of chatApi.stream(
          cleanText,
          deck,
          apiHighlightedWords,
          userContext,
          mode,
          controller.signal
        )) {
          switch (event.type) {
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
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        activeControllersRef.current.delete(controller);
        decrementStreams();
      }
    },
    [setMessages, setError, incrementStreams, decrementStreams]
  );

  const retryWithContext = useCallback(
    async (assistantMsgId: string, context: string) => {
      const controller = new AbortController();
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
      incrementStreams();
      activeControllersRef.current.add(controller);

      const settings = useSettingsStore.getState().settings;

      try {
        for await (const event of chatApi.stream(
          originalQuery,
          settings.defaultDeck,
          retryHighlightedWords,
          userContext,
          undefined,
          controller.signal
        )) {
          switch (event.type) {
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
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        activeControllersRef.current.delete(controller);
        decrementStreams();
      }
    },
    [setMessages, setError, incrementStreams, decrementStreams]
  );

  const clearChat = useCallback(() => {
    // Abort all active streams
    for (const controller of activeControllersRef.current) {
      controller.abort();
    }
    activeControllersRef.current.clear();
    clearMessages();
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
