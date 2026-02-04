import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardPreview } from 'shared';

export interface SessionCard extends CardPreview {
  id: string;
  createdAt: number;
  noteId?: number;
  syncedToAnki: boolean;
  deckName: string; // The deck this card was actually added to
  modelName: string;
}

export interface PendingCard extends CardPreview {
  id: string;
  createdAt: number;
  deckName: string;
  modelName: string;
}

interface SessionCardsState {
  // Cards successfully created this session
  cards: SessionCard[];
  // Cards waiting to be synced to Anki (when Anki unavailable)
  pendingQueue: PendingCard[];

  // Actions
  addCard: (
    card: Omit<SessionCard, 'id' | 'createdAt' | 'syncedToAnki' | 'deckName' | 'modelName'>,
    deckName: string,
    modelName: string,
    noteId?: number
  ) => void;
  removeCard: (id: string) => void;
  clearCards: () => void;

  // Pending queue actions
  addToPendingQueue: (card: Omit<PendingCard, 'id' | 'createdAt'>) => string; // Returns the ID
  removeFromPendingQueue: (id: string) => void;
  clearPendingQueue: () => void;

  // Check if word exists in session
  hasWord: (word: string) => boolean;
  getWordsByLemma: () => Set<string>;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export const useSessionCards = create<SessionCardsState>()(
  persist(
    (set, get) => ({
      cards: [],
      pendingQueue: [],

      addCard: (card, deckName, modelName, noteId) =>
        set((state) => ({
          cards: [
            ...state.cards,
            {
              ...card,
              id: generateId(),
              createdAt: Date.now(),
              noteId,
              syncedToAnki: !!noteId,
              deckName,
              modelName,
            },
          ],
        })),

      removeCard: (id) =>
        set((state) => ({
          cards: state.cards.filter((c) => c.id !== id),
        })),

      clearCards: () => set({ cards: [] }),

      addToPendingQueue: (card) => {
        const id = generateId();
        set((state) => ({
          pendingQueue: [
            ...state.pendingQueue,
            {
              ...card,
              id,
              createdAt: Date.now(),
            },
          ],
        }));
        return id;
      },

      removeFromPendingQueue: (id) =>
        set((state) => ({
          pendingQueue: state.pendingQueue.filter((c) => c.id !== id),
        })),

      clearPendingQueue: () => set({ pendingQueue: [] }),

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
    }),
    {
      name: 'bangla-session-cards',
      partialize: (state) => ({
        // Only persist the pending queue (cards waiting for Anki)
        pendingQueue: state.pendingQueue,
      }),
    }
  )
);
