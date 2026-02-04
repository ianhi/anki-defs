import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardContent } from 'shared';

// A card that has been added to Anki this session
export interface SessionCard extends CardContent {
  id: string; // Internal tracking ID
  createdAt: number;
  noteId: number; // The Anki note ID
  deckName: string; // The deck this card was added to
  modelName: string;
}

// A card waiting to be synced to Anki (queued when Anki unavailable)
export interface PendingCard extends CardContent {
  id: string; // Internal tracking ID
  createdAt: number;
  deckName: string; // Target deck
  modelName: string; // Target model
}

interface SessionCardsState {
  // Cards successfully created this session
  cards: SessionCard[];
  // Cards waiting to be synced to Anki (when Anki unavailable)
  pendingQueue: PendingCard[];

  // Actions
  addCard: (card: CardContent, deckName: string, modelName: string, noteId: number) => void;
  removeCard: (id: string) => void;
  clearCards: () => void;

  // Pending queue actions
  addToPendingQueue: (card: CardContent, deckName: string, modelName: string) => string; // Returns the ID
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
              word: card.word,
              definition: card.definition,
              exampleSentence: card.exampleSentence,
              sentenceTranslation: card.sentenceTranslation,
              id: generateId(),
              createdAt: Date.now(),
              noteId,
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

      addToPendingQueue: (card, deckName, modelName) => {
        const id = generateId();
        set((state) => ({
          pendingQueue: [
            ...state.pendingQueue,
            {
              word: card.word,
              definition: card.definition,
              exampleSentence: card.exampleSentence,
              sentenceTranslation: card.sentenceTranslation,
              id,
              createdAt: Date.now(),
              deckName,
              modelName,
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
