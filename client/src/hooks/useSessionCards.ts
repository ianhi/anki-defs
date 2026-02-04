import { create } from 'zustand';
import type { CardPreview } from 'shared';

export interface SessionCard extends CardPreview {
  id: string;
  createdAt: number;
  noteId?: number;
}

interface SessionCardsState {
  cards: SessionCard[];
  pendingCard: CardPreview | null;
  addCard: (card: SessionCard) => void;
  removeCard: (id: string) => void;
  setPendingCard: (card: CardPreview | null) => void;
  clearCards: () => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export const useSessionCards = create<SessionCardsState>((set) => ({
  cards: [],
  pendingCard: null,

  addCard: (card) =>
    set((state) => ({
      cards: [...state.cards, { ...card, id: card.id || generateId() }],
      pendingCard: null,
    })),

  removeCard: (id) =>
    set((state) => ({
      cards: state.cards.filter((c) => c.id !== id),
    })),

  setPendingCard: (card) => set({ pendingCard: card }),

  clearCards: () => set({ cards: [], pendingCard: null }),
}));
