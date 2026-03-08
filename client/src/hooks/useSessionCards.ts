import { create } from 'zustand';
import type { CardContent, SessionCard, PendingCard } from 'shared';
import { generateId } from '@/lib/utils';
import { sessionApi } from '@/lib/api';

interface SessionCardsState {
  cards: SessionCard[];
  pendingQueue: PendingCard[];
  loaded: boolean;

  // Load from server
  fetchState: () => Promise<void>;

  // Actions (optimistic local update + fire-and-forget server call)
  addCard: (card: CardContent, deckName: string, modelName: string, noteId: number) => void;
  removeCard: (id: string) => void;
  clearCards: () => void;

  addToPendingQueue: (card: CardContent, deckName: string, modelName: string) => string;
  removeFromPendingQueue: (id: string) => void;
  clearPendingQueue: () => void;

  hasWord: (word: string) => boolean;
  getWordsByLemma: () => Set<string>;
}

export const useSessionCards = create<SessionCardsState>()((set, get) => ({
  cards: [],
  pendingQueue: [],
  loaded: false,

  fetchState: async () => {
    try {
      const state = await sessionApi.getState();
      set({ cards: state.cards, pendingQueue: state.pendingQueue, loaded: true });
    } catch (err) {
      console.error('[Session] Failed to fetch state from server:', err);
      set({ loaded: true });
    }
  },

  addCard: (card, deckName, modelName, noteId) => {
    const sessionCard: SessionCard = {
      word: card.word,
      definition: card.definition,
      banglaDefinition: card.banglaDefinition,
      exampleSentence: card.exampleSentence,
      sentenceTranslation: card.sentenceTranslation,
      id: generateId(),
      createdAt: Date.now(),
      noteId,
      deckName,
      modelName,
    };
    set((state) => ({ cards: [...state.cards, sessionCard] }));
    sessionApi.addCard(sessionCard).catch((err) => {
      console.error('[Session] Failed to persist card to server:', err);
    });
  },

  removeCard: (id) => {
    set((state) => ({ cards: state.cards.filter((c) => c.id !== id) }));
    sessionApi.removeCard(id).catch((err) => {
      console.error('[Session] Failed to remove card from server:', err);
    });
  },

  clearCards: () => {
    set({ cards: [], pendingQueue: [] });
    sessionApi.clear().catch((err) => {
      console.error('[Session] Failed to clear session on server:', err);
    });
  },

  addToPendingQueue: (card, deckName, modelName) => {
    const id = generateId();
    const pendingCard: PendingCard = {
      word: card.word,
      definition: card.definition,
      banglaDefinition: card.banglaDefinition,
      exampleSentence: card.exampleSentence,
      sentenceTranslation: card.sentenceTranslation,
      id,
      createdAt: Date.now(),
      deckName,
      modelName,
    };
    set((state) => ({ pendingQueue: [...state.pendingQueue, pendingCard] }));
    sessionApi.addPending(pendingCard).catch((err) => {
      console.error('[Session] Failed to persist pending card to server:', err);
    });
    return id;
  },

  removeFromPendingQueue: (id) => {
    set((state) => ({ pendingQueue: state.pendingQueue.filter((c) => c.id !== id) }));
    sessionApi.removePending(id).catch((err) => {
      console.error('[Session] Failed to remove pending card from server:', err);
    });
  },

  clearPendingQueue: () => {
    set({ pendingQueue: [] });
    // No dedicated endpoint for clearing just pending — use clear all
    // This is fine since clearPendingQueue is not used standalone
  },

  hasWord: (word) => {
    const state = get();
    const normalizedWord = word.toLowerCase().trim();
    return (
      state.cards.some((c) => c.word.toLowerCase().trim() === normalizedWord) ||
      state.pendingQueue.some((c) => c.word.toLowerCase().trim() === normalizedWord)
    );
  },

  getWordsByLemma: () => {
    const state = get();
    const words = new Set<string>();
    state.cards.forEach((c) => words.add(c.word.toLowerCase().trim()));
    state.pendingQueue.forEach((c) => words.add(c.word.toLowerCase().trim()));
    return words;
  },
}));

// Initialization — fetch on startup, refetch on tab focus, poll as safety net
let initialized = false;

export function initSessionCards(): () => void {
  if (initialized) return () => {};
  initialized = true;

  useSessionCards.getState().fetchState();

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      useSessionCards.getState().fetchState();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  const intervalId = setInterval(() => {
    if (document.visibilityState === 'visible') {
      useSessionCards.getState().fetchState();
    }
  }, 30_000);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
    clearInterval(intervalId);
    initialized = false;
  };
}
