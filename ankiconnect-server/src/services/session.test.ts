import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { SessionCard, PendingCard } from 'shared';

/**
 * Tests for the session service SQLite logic.
 *
 * The production session.ts initializes a DB at module scope (top-level),
 * making it hard to import directly in tests without side effects.
 * Instead, we replicate the SQL schema and test the same queries against
 * a temporary in-memory database. This validates the SQL logic without
 * touching the user's real session DB.
 */

function createTestDb(dbPath?: string) {
  const db = new Database(dbPath ?? ':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      word TEXT NOT NULL,
      definition TEXT NOT NULL,
      banglaDefinition TEXT NOT NULL DEFAULT '',
      exampleSentence TEXT NOT NULL DEFAULT '',
      sentenceTranslation TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      noteId INTEGER NOT NULL,
      deckName TEXT NOT NULL,
      modelName TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending (
      id TEXT PRIMARY KEY,
      word TEXT NOT NULL,
      definition TEXT NOT NULL,
      banglaDefinition TEXT NOT NULL DEFAULT '',
      exampleSentence TEXT NOT NULL DEFAULT '',
      sentenceTranslation TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      deckName TEXT NOT NULL,
      modelName TEXT NOT NULL
    );
  `);

  const stmts = {
    allCards: db.prepare('SELECT * FROM cards ORDER BY createdAt'),
    allPending: db.prepare('SELECT * FROM pending ORDER BY createdAt'),
    insertCard: db.prepare(
      'INSERT OR REPLACE INTO cards (id, word, definition, banglaDefinition, exampleSentence, sentenceTranslation, createdAt, noteId, deckName, modelName) VALUES (@id, @word, @definition, @banglaDefinition, @exampleSentence, @sentenceTranslation, @createdAt, @noteId, @deckName, @modelName)'
    ),
    insertPending: db.prepare(
      'INSERT OR REPLACE INTO pending (id, word, definition, banglaDefinition, exampleSentence, sentenceTranslation, createdAt, deckName, modelName) VALUES (@id, @word, @definition, @banglaDefinition, @exampleSentence, @sentenceTranslation, @createdAt, @deckName, @modelName)'
    ),
    deleteCard: db.prepare('DELETE FROM cards WHERE id = ?'),
    deletePending: db.prepare('DELETE FROM pending WHERE id = ?'),
    getPending: db.prepare('SELECT * FROM pending WHERE id = ?'),
    clearCards: db.prepare('DELETE FROM cards'),
    clearPending: db.prepare('DELETE FROM pending'),
  };

  const promoteTx = db.transaction((pendingId: string, noteId: number): SessionCard | null => {
    const pending = stmts.getPending.get(pendingId) as PendingCard | undefined;
    if (!pending) return null;
    stmts.deletePending.run(pendingId);
    const card: SessionCard = {
      id: pending.id,
      createdAt: pending.createdAt,
      word: pending.word,
      definition: pending.definition,
      banglaDefinition: pending.banglaDefinition,
      exampleSentence: pending.exampleSentence,
      sentenceTranslation: pending.sentenceTranslation,
      deckName: pending.deckName,
      modelName: pending.modelName,
      noteId,
    };
    stmts.insertCard.run(card);
    return card;
  });

  const clearAllTx = db.transaction(() => {
    stmts.clearCards.run();
    stmts.clearPending.run();
  });

  return {
    db,
    getState: () => ({
      cards: stmts.allCards.all() as SessionCard[],
      pendingQueue: stmts.allPending.all() as PendingCard[],
    }),
    addCard: (card: SessionCard) => stmts.insertCard.run(card),
    removeCard: (id: string) => stmts.deleteCard.run(id).changes > 0,
    addPending: (card: PendingCard) => stmts.insertPending.run(card),
    removePending: (id: string) => stmts.deletePending.run(id).changes > 0,
    promotePending: (pendingId: string, noteId: number) => promoteTx(pendingId, noteId),
    clearAll: () => clearAllTx(),
  };
}

function makeSessionCard(overrides: Partial<SessionCard> = {}): SessionCard {
  return {
    id: 'card-1',
    word: 'বাজার',
    definition: 'market',
    banglaDefinition: 'যেখানে কেনাবেচা হয়',
    exampleSentence: 'আমি বাজারে যাচ্ছি।',
    sentenceTranslation: 'I am going to the market.',
    createdAt: Date.now(),
    noteId: 12345,
    deckName: 'Bangla',
    modelName: 'Bangla (and reversed)',
    ...overrides,
  };
}

function makePendingCard(overrides: Partial<PendingCard> = {}): PendingCard {
  return {
    id: 'pending-1',
    word: 'আকাশ',
    definition: 'sky',
    banglaDefinition: 'মাথার উপরে যা দেখা যায়',
    exampleSentence: 'আকাশ নীল।',
    sentenceTranslation: 'The sky is blue.',
    createdAt: Date.now(),
    deckName: 'Bangla',
    modelName: 'Bangla (and reversed)',
    ...overrides,
  };
}

describe('session service (SQLite logic)', () => {
  let session: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    session = createTestDb();
  });

  afterEach(() => {
    session.db.close();
  });

  describe('getState', () => {
    it('returns empty state initially', () => {
      const state = session.getState();
      expect(state.cards).toEqual([]);
      expect(state.pendingQueue).toEqual([]);
    });
  });

  describe('addCard / removeCard round-trip', () => {
    it('adds a card and retrieves it', () => {
      const card = makeSessionCard();
      session.addCard(card);
      const state = session.getState();
      expect(state.cards).toHaveLength(1);
      expect(state.cards[0]!.word).toBe('বাজার');
      expect(state.cards[0]!.noteId).toBe(12345);
    });

    it('removes a card by id', () => {
      const card = makeSessionCard();
      session.addCard(card);
      const removed = session.removeCard('card-1');
      expect(removed).toBe(true);
      expect(session.getState().cards).toHaveLength(0);
    });

    it('removeCard returns false for non-existent id', () => {
      const removed = session.removeCard('nonexistent');
      expect(removed).toBe(false);
    });

    it('upserts card with same id (INSERT OR REPLACE)', () => {
      session.addCard(makeSessionCard({ id: 'card-1', word: 'original' }));
      session.addCard(makeSessionCard({ id: 'card-1', word: 'updated' }));
      const state = session.getState();
      expect(state.cards).toHaveLength(1);
      expect(state.cards[0]!.word).toBe('updated');
    });

    it('maintains insertion order by createdAt', () => {
      session.addCard(makeSessionCard({ id: 'c1', createdAt: 200 }));
      session.addCard(makeSessionCard({ id: 'c2', createdAt: 100 }));
      session.addCard(makeSessionCard({ id: 'c3', createdAt: 300 }));
      const state = session.getState();
      expect(state.cards.map((c) => c.id)).toEqual(['c2', 'c1', 'c3']);
    });
  });

  describe('addPending / removePending', () => {
    it('adds a pending card and retrieves it', () => {
      const pending = makePendingCard();
      session.addPending(pending);
      const state = session.getState();
      expect(state.pendingQueue).toHaveLength(1);
      expect(state.pendingQueue[0]!.word).toBe('আকাশ');
    });

    it('removes a pending card by id', () => {
      session.addPending(makePendingCard());
      const removed = session.removePending('pending-1');
      expect(removed).toBe(true);
      expect(session.getState().pendingQueue).toHaveLength(0);
    });

    it('removePending returns false for non-existent id', () => {
      expect(session.removePending('nope')).toBe(false);
    });
  });

  describe('promotePending', () => {
    it('moves pending card to cards with a noteId', () => {
      session.addPending(makePendingCard({ id: 'p1' }));
      const promoted = session.promotePending('p1', 99999);

      expect(promoted).not.toBeNull();
      expect(promoted!.noteId).toBe(99999);
      expect(promoted!.id).toBe('p1');

      const state = session.getState();
      expect(state.pendingQueue).toHaveLength(0);
      expect(state.cards).toHaveLength(1);
      expect(state.cards[0]!.id).toBe('p1');
    });

    it('returns null when pending card does not exist', () => {
      const result = session.promotePending('nonexistent', 1);
      expect(result).toBeNull();
    });

    it('preserves all fields during promotion', () => {
      const pending = makePendingCard({
        id: 'p2',
        word: 'পানি',
        definition: 'water',
        banglaDefinition: 'তরল পদার্থ',
        exampleSentence: 'পানি পান করো।',
        sentenceTranslation: 'Drink water.',
        createdAt: 42,
      });
      session.addPending(pending);
      const promoted = session.promotePending('p2', 777);

      expect(promoted).toEqual({
        id: 'p2',
        word: 'পানি',
        definition: 'water',
        banglaDefinition: 'তরল পদার্থ',
        exampleSentence: 'পানি পান করো।',
        sentenceTranslation: 'Drink water.',
        createdAt: 42,
        deckName: 'Bangla',
        modelName: 'Bangla (and reversed)',
        noteId: 777,
      });
    });
  });

  describe('clearAll', () => {
    it('removes all cards and pending cards', () => {
      session.addCard(makeSessionCard({ id: 'c1' }));
      session.addCard(makeSessionCard({ id: 'c2' }));
      session.addPending(makePendingCard({ id: 'p1' }));

      session.clearAll();

      const state = session.getState();
      expect(state.cards).toEqual([]);
      expect(state.pendingQueue).toEqual([]);
    });

    it('is idempotent on empty state', () => {
      session.clearAll();
      expect(session.getState().cards).toEqual([]);
    });
  });

  describe('persistence across re-open', () => {
    it('data survives database close and reopen', () => {
      const tmpDir = mkdtempSync(join(tmpdir(), 'session-test-'));
      const dbPath = join(tmpDir, 'test-session.db');

      // Write data
      const s1 = createTestDb(dbPath);
      s1.addCard(makeSessionCard({ id: 'persist-1' }));
      s1.addPending(makePendingCard({ id: 'persist-p1' }));
      s1.db.close();

      // Re-open and verify
      const s2 = createTestDb(dbPath);
      const state = s2.getState();
      expect(state.cards).toHaveLength(1);
      expect(state.cards[0]!.id).toBe('persist-1');
      expect(state.pendingQueue).toHaveLength(1);
      expect(state.pendingQueue[0]!.id).toBe('persist-p1');
      s2.db.close();

      // Cleanup
      rmSync(tmpDir, { recursive: true });
    });
  });
});
