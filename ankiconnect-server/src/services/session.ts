import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { SessionCard, PendingCard, SessionState } from 'shared';

const CONFIG_DIR = join(homedir(), '.config', 'bangla-anki');
const DB_FILE = join(CONFIG_DIR, 'session.db');

if (!existsSync(CONFIG_DIR)) {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    definition TEXT NOT NULL,
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
    exampleSentence TEXT NOT NULL DEFAULT '',
    sentenceTranslation TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL,
    deckName TEXT NOT NULL,
    modelName TEXT NOT NULL
  );
`);

// Prepared statements
const stmts = {
  allCards: db.prepare('SELECT * FROM cards ORDER BY createdAt'),
  allPending: db.prepare('SELECT * FROM pending ORDER BY createdAt'),
  insertCard: db.prepare(
    'INSERT OR REPLACE INTO cards (id, word, definition, exampleSentence, sentenceTranslation, createdAt, noteId, deckName, modelName) VALUES (@id, @word, @definition, @exampleSentence, @sentenceTranslation, @createdAt, @noteId, @deckName, @modelName)'
  ),
  insertPending: db.prepare(
    'INSERT OR REPLACE INTO pending (id, word, definition, exampleSentence, sentenceTranslation, createdAt, deckName, modelName) VALUES (@id, @word, @definition, @exampleSentence, @sentenceTranslation, @createdAt, @deckName, @modelName)'
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

// --- Public API (all synchronous thanks to better-sqlite3) ---

export async function getState(): Promise<SessionState> {
  return {
    cards: stmts.allCards.all() as SessionCard[],
    pendingQueue: stmts.allPending.all() as PendingCard[],
  };
}

export async function addCard(card: SessionCard): Promise<void> {
  stmts.insertCard.run(card);
}

export async function removeCard(id: string): Promise<boolean> {
  const result = stmts.deleteCard.run(id);
  return result.changes > 0;
}

export async function addPending(card: PendingCard): Promise<void> {
  stmts.insertPending.run(card);
}

export async function removePending(id: string): Promise<boolean> {
  const result = stmts.deletePending.run(id);
  return result.changes > 0;
}

export async function promotePending(
  pendingId: string,
  noteId: number
): Promise<SessionCard | null> {
  return promoteTx(pendingId, noteId);
}

export async function clearAll(): Promise<void> {
  clearAllTx();
}
