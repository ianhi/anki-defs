import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { SessionCard, PendingCard, SessionState, TokenUsage } from 'shared';

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

  CREATE INDEX IF NOT EXISTS idx_cards_word ON cards(word);
  CREATE INDEX IF NOT EXISTS idx_cards_definition ON cards(definition);

  CREATE TABLE IF NOT EXISTS usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inputTokens INTEGER NOT NULL,
    outputTokens INTEGER NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    cost REAL NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL
  );
`);

// Migration: add banglaDefinition column to existing tables
try {
  db.exec("ALTER TABLE cards ADD COLUMN banglaDefinition TEXT NOT NULL DEFAULT ''");
} catch {
  /* column already exists */
}
try {
  db.exec("ALTER TABLE pending ADD COLUMN banglaDefinition TEXT NOT NULL DEFAULT ''");
} catch {
  /* column already exists */
}

// Prepared statements
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
  insertUsage: db.prepare(
    'INSERT INTO usage_log (inputTokens, outputTokens, provider, model, cost, createdAt) VALUES (@inputTokens, @outputTokens, @provider, @model, @cost, @createdAt)'
  ),
  usageTotals: db.prepare(
    'SELECT COALESCE(SUM(inputTokens), 0) as totalInputTokens, COALESCE(SUM(outputTokens), 0) as totalOutputTokens, COALESCE(SUM(cost), 0) as totalCost, COUNT(*) as requestCount FROM usage_log'
  ),
  clearUsage: db.prepare('DELETE FROM usage_log'),
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

// --- Usage tracking ---

export interface UsageTotals {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  requestCount: number;
}

export function recordUsage(usage: TokenUsage, cost: number): void {
  stmts.insertUsage.run({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    provider: usage.provider,
    model: usage.model || '',
    cost,
    createdAt: Date.now(),
  });
}

export function getUsageTotals(): UsageTotals {
  return stmts.usageTotals.get() as UsageTotals;
}

export function clearUsage(): void {
  stmts.clearUsage.run();
}

// --- History search ---

export interface HistoryResult {
  items: SessionCard[];
  total: number;
}

export function searchHistory(
  query?: string,
  limit: number = 50,
  offset: number = 0
): HistoryResult {
  if (query && query.trim()) {
    const pattern = `%${query.trim()}%`;
    const where =
      'WHERE word LIKE ? OR definition LIKE ? OR banglaDefinition LIKE ? OR sentenceTranslation LIKE ?';
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM cards ${where}`);
    const selectStmt = db.prepare(
      `SELECT * FROM cards ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
    );
    const { total } = countStmt.get(pattern, pattern, pattern, pattern) as { total: number };
    const items = selectStmt.all(
      pattern,
      pattern,
      pattern,
      pattern,
      limit,
      offset
    ) as SessionCard[];
    return { items, total };
  } else {
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM cards');
    const selectStmt = db.prepare('SELECT * FROM cards ORDER BY createdAt DESC LIMIT ? OFFSET ?');
    const { total } = countStmt.get() as { total: number };
    const items = selectStmt.all(limit, offset) as SessionCard[];
    return { items, total };
  }
}
