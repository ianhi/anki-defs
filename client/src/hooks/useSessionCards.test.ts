import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub the minimal DOM APIs that useSessionCards.ts uses at module scope
// (document.addEventListener, document.visibilityState, setInterval)
if (typeof document === 'undefined') {
  // @ts-expect-error -- minimal stub for Node environment
  globalThis.document = {
    addEventListener: vi.fn(),
    visibilityState: 'hidden',
  };
}

// Mock the API module before importing the store
vi.mock('@/lib/api', () => ({
  sessionApi: {
    getState: vi.fn().mockResolvedValue({ cards: [], pendingQueue: [] }),
    addCard: vi.fn().mockResolvedValue(undefined),
    removeCard: vi.fn().mockResolvedValue(undefined),
    addPending: vi.fn().mockResolvedValue(undefined),
    removePending: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock generateId to return predictable values
let idCounter = 0;
vi.mock('@/lib/utils', () => ({
  generateId: () => `test-id-${++idCounter}`,
}));

// Import after mocks are set up
const { useSessionCards } = await import('./useSessionCards');

describe('useSessionCards store', () => {
  beforeEach(() => {
    idCounter = 0;
    // Reset store state
    useSessionCards.setState({ cards: [], pendingQueue: [], loaded: false });
  });

  describe('initial state', () => {
    it('starts with empty cards and pending queue', () => {
      const state = useSessionCards.getState();
      expect(state.cards).toEqual([]);
      expect(state.pendingQueue).toEqual([]);
    });
  });

  describe('addCard', () => {
    it('adds a card to state', () => {
      useSessionCards.getState().addCard(
        {
          word: 'বাজার',
          definition: 'market',
          nativeDefinition: 'হাট',
          exampleSentence: 'বাজারে যাও।',
          sentenceTranslation: 'Go to the market.',
        },
        'Bangla',
        'Bangla (and reversed)',
        12345
      );

      const state = useSessionCards.getState();
      expect(state.cards).toHaveLength(1);
      expect(state.cards[0]!.word).toBe('বাজার');
      expect(state.cards[0]!.noteId).toBe(12345);
      expect(state.cards[0]!.deckName).toBe('Bangla');
      expect(state.cards[0]!.id).toBe('test-id-1');
    });

    it('appends multiple cards', () => {
      const { addCard } = useSessionCards.getState();
      const cardContent = {
        word: 'test',
        definition: 'test',
        nativeDefinition: '',
        exampleSentence: '',
        sentenceTranslation: '',
      };

      addCard(cardContent, 'Deck', 'Model', 1);
      addCard({ ...cardContent, word: 'second' }, 'Deck', 'Model', 2);

      expect(useSessionCards.getState().cards).toHaveLength(2);
    });
  });

  describe('removeCard', () => {
    it('removes a card by id', () => {
      useSessionCards.getState().addCard(
        {
          word: 'test',
          definition: 'test',
          nativeDefinition: '',
          exampleSentence: '',
          sentenceTranslation: '',
        },
        'Deck',
        'Model',
        1
      );

      const cardId = useSessionCards.getState().cards[0]!.id;
      useSessionCards.getState().removeCard(cardId);

      expect(useSessionCards.getState().cards).toHaveLength(0);
    });

    it('only removes the matching card', () => {
      const content = {
        word: 'a',
        definition: 'b',
        nativeDefinition: '',
        exampleSentence: '',
        sentenceTranslation: '',
      };
      useSessionCards.getState().addCard(content, 'D', 'M', 1);
      useSessionCards.getState().addCard({ ...content, word: 'keep' }, 'D', 'M', 2);

      const firstId = useSessionCards.getState().cards[0]!.id;
      useSessionCards.getState().removeCard(firstId);

      const remaining = useSessionCards.getState().cards;
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.word).toBe('keep');
    });
  });

  describe('clearCards', () => {
    it('clears all cards and pending', () => {
      const content = {
        word: 'test',
        definition: 'test',
        nativeDefinition: '',
        exampleSentence: '',
        sentenceTranslation: '',
      };
      useSessionCards.getState().addCard(content, 'D', 'M', 1);
      useSessionCards.getState().addToPendingQueue(content, 'D', 'M');

      useSessionCards.getState().clearCards();

      const state = useSessionCards.getState();
      expect(state.cards).toEqual([]);
      expect(state.pendingQueue).toEqual([]);
    });
  });

  describe('addToPendingQueue / removeFromPendingQueue', () => {
    it('adds to pending queue and returns id', () => {
      const id = useSessionCards.getState().addToPendingQueue(
        {
          word: 'পানি',
          definition: 'water',
          nativeDefinition: '',
          exampleSentence: '',
          sentenceTranslation: '',
        },
        'Deck',
        'Model'
      );

      expect(id).toBeTruthy();
      const state = useSessionCards.getState();
      expect(state.pendingQueue).toHaveLength(1);
      expect(state.pendingQueue[0]!.word).toBe('পানি');
    });

    it('removes from pending queue by id', () => {
      const id = useSessionCards.getState().addToPendingQueue(
        {
          word: 'test',
          definition: 'test',
          nativeDefinition: '',
          exampleSentence: '',
          sentenceTranslation: '',
        },
        'D',
        'M'
      );

      useSessionCards.getState().removeFromPendingQueue(id);
      expect(useSessionCards.getState().pendingQueue).toHaveLength(0);
    });
  });

  describe('hasWord', () => {
    it('returns true when word is in cards', () => {
      useSessionCards.getState().addCard(
        {
          word: 'বাজার',
          definition: 'market',
          nativeDefinition: '',
          exampleSentence: '',
          sentenceTranslation: '',
        },
        'D',
        'M',
        1
      );

      expect(useSessionCards.getState().hasWord('বাজার')).toBe(true);
    });

    it('returns true when word is in pending queue', () => {
      useSessionCards.getState().addToPendingQueue(
        {
          word: 'পানি',
          definition: 'water',
          nativeDefinition: '',
          exampleSentence: '',
          sentenceTranslation: '',
        },
        'D',
        'M'
      );

      expect(useSessionCards.getState().hasWord('পানি')).toBe(true);
    });

    it('returns false for absent words', () => {
      expect(useSessionCards.getState().hasWord('nonexistent')).toBe(false);
    });

    it('is case-insensitive', () => {
      useSessionCards.getState().addCard(
        {
          word: 'Hello',
          definition: 'greeting',
          nativeDefinition: '',
          exampleSentence: '',
          sentenceTranslation: '',
        },
        'D',
        'M',
        1
      );

      expect(useSessionCards.getState().hasWord('hello')).toBe(true);
      expect(useSessionCards.getState().hasWord('HELLO')).toBe(true);
    });

    it('trims whitespace', () => {
      useSessionCards.getState().addCard(
        {
          word: 'test',
          definition: 'test',
          nativeDefinition: '',
          exampleSentence: '',
          sentenceTranslation: '',
        },
        'D',
        'M',
        1
      );

      expect(useSessionCards.getState().hasWord('  test  ')).toBe(true);
    });
  });

  describe('getWordsByLemma', () => {
    it('returns set of all words from cards and pending', () => {
      const content = {
        definition: 'test',
        nativeDefinition: '',
        exampleSentence: '',
        sentenceTranslation: '',
      };
      useSessionCards.getState().addCard({ ...content, word: 'বাজার' }, 'D', 'M', 1);
      useSessionCards.getState().addToPendingQueue({ ...content, word: 'পানি' }, 'D', 'M');

      const words = useSessionCards.getState().getWordsByLemma();
      expect(words).toBeInstanceOf(Set);
      expect(words.has('বাজার')).toBe(true);
      expect(words.has('পানি')).toBe(true);
      expect(words.size).toBe(2);
    });

    it('normalizes to lowercase', () => {
      useSessionCards.getState().addCard(
        {
          word: 'Hello',
          definition: 'test',
          nativeDefinition: '',
          exampleSentence: '',
          sentenceTranslation: '',
        },
        'D',
        'M',
        1
      );

      const words = useSessionCards.getState().getWordsByLemma();
      expect(words.has('hello')).toBe(true);
      expect(words.has('Hello')).toBe(false);
    });

    it('returns empty set when no cards', () => {
      const words = useSessionCards.getState().getWordsByLemma();
      expect(words.size).toBe(0);
    });
  });
});
