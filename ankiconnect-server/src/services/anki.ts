import { YankiConnect } from 'yanki-connect';
import type { AnkiNote, CreateCardParams } from 'shared';
import { getSettings } from './settings.js';

let client: YankiConnect | null = null;
let clientUrl: string | null = null;

async function getClient(): Promise<YankiConnect> {
  const settings = await getSettings();
  const url = settings.ankiConnectUrl || 'http://localhost:8765';

  // Recreate client if URL changed
  if (!client || clientUrl !== url) {
    const parsed = new URL(url);
    client = new YankiConnect({
      autoLaunch: false,
      host: `${parsed.protocol}//${parsed.hostname}`,
      port: parseInt(parsed.port || '8765', 10),
    });
    clientUrl = url;
  }
  return client;
}

export async function getDecks(): Promise<string[]> {
  const ankiClient = await getClient();
  return ankiClient.deck.deckNames();
}

export async function getModels(): Promise<string[]> {
  const ankiClient = await getClient();
  return ankiClient.model.modelNames();
}

export async function getModelFields(modelName: string): Promise<string[]> {
  const ankiClient = await getClient();
  return ankiClient.model.modelFieldNames({ modelName });
}

export async function searchNotes(query: string): Promise<AnkiNote[]> {
  const ankiClient = await getClient();
  const noteIds = await ankiClient.note.findNotes({ query });
  if (noteIds.length === 0) return [];

  const notesInfo = await ankiClient.note.notesInfo({ notes: noteIds });
  return notesInfo
    .filter((note): note is NonNullable<typeof note> => note !== undefined)
    .map((note) => ({
      noteId: note.noteId,
      modelName: note.modelName,
      tags: note.tags,
      fields: note.fields,
    }));
}

export async function searchWord(word: string, deckName: string): Promise<AnkiNote | null> {
  const escapedDeck = deckName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escapedWord = word.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // Search the word field from settings mapping, plus common fallbacks
  const settings = await getSettings();
  const wordField = settings.fieldMapping?.Word;
  const wordFields = new Set(['Front', 'Word']);
  if (wordField) wordFields.add(wordField);

  const fieldQueries = [...wordFields].map((f) => `${f}:"${escapedWord}"`).join(' OR ');
  const query = `deck:"${escapedDeck}" (${fieldQueries})`;
  const notes = await searchNotes(query);
  return notes[0] ?? null;
}

export async function searchWords(
  words: string[],
  deckName: string
): Promise<Map<string, AnkiNote>> {
  const results = new Map<string, AnkiNote>();

  const entries = await Promise.all(
    words.map(async (word) => {
      const note = await searchWord(word, deckName);
      return [word, note] as const;
    })
  );

  for (const [word, note] of entries) {
    if (note) {
      results.set(word, note);
    }
  }

  return results;
}

export async function getNoteById(noteId: number): Promise<AnkiNote | null> {
  const ankiClient = await getClient();
  const notesInfo = await ankiClient.note.notesInfo({ notes: [noteId] });
  const note = notesInfo[0];
  if (!note) return null;

  return {
    noteId: note.noteId,
    modelName: note.modelName,
    tags: note.tags,
    fields: note.fields,
  };
}

export async function createCard(params: CreateCardParams): Promise<number> {
  const ankiClient = await getClient();
  const settings = await getSettings();

  // Use field mapping from settings, falling back to identity mapping
  const mapping = settings.fieldMapping || {};

  // Map standard field names to model-specific field names
  const fields: Record<string, string> = {};
  if (params.word) {
    fields[mapping.Word || 'Word'] = params.word;
  }
  if (params.definition) {
    fields[mapping.Definition || 'Definition'] = params.definition;
  }
  if (params.exampleSentence) {
    fields[mapping.Example || 'Example'] = params.exampleSentence;
  }
  if (params.sentenceTranslation) {
    fields[mapping.Translation || 'Translation'] = params.sentenceTranslation;
  }

  console.log('[Anki] Creating card with model:', params.model);
  console.log('[Anki] Field mapping:', mapping);
  console.log('[Anki] Fields:', fields);

  const noteId = await ankiClient.note.addNote({
    note: {
      deckName: params.deck,
      modelName: params.model,
      fields,
      tags: params.tags || ['auto-generated'],
    },
  });

  if (noteId === null) {
    throw new Error('Failed to create note - duplicate or invalid');
  }

  // Add word to cache for offline duplicate detection
  if (params.word) {
    addWordToCache(params.word, params.deck);
  }

  return noteId;
}

export async function deleteNote(noteId: number): Promise<void> {
  const ankiClient = await getClient();
  await ankiClient.note.deleteNotes({ notes: [noteId] });
}

export async function sync(): Promise<void> {
  const ankiClient = await getClient();
  await ankiClient.miscellaneous.sync();
}

export async function testConnection(): Promise<boolean> {
  try {
    const ankiClient = await getClient();
    await ankiClient.miscellaneous.version();
    // Refresh word cache on successful connection
    refreshWordCache().catch((err) =>
      console.warn('[Anki] Word cache refresh failed:', err)
    );
    return true;
  } catch {
    return false;
  }
}

// --- Word cache for offline duplicate detection ---

const wordCache = new Map<string, Set<string>>();
let lastCacheRefresh = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // Refresh at most every 5 minutes

async function refreshWordCache(): Promise<void> {
  const now = Date.now();
  if (now - lastCacheRefresh < CACHE_TTL_MS) return;
  lastCacheRefresh = now;
  const settings = await getSettings();
  const deckName = settings.defaultDeck;
  if (!deckName) return;

  const ankiClient = await getClient();
  const escapedDeck = deckName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const noteIds = await ankiClient.note.findNotes({ query: `deck:"${escapedDeck}"` });
  if (noteIds.length === 0) {
    wordCache.set(deckName, new Set());
    return;
  }

  const notesInfo = await ankiClient.note.notesInfo({ notes: noteIds });
  const wordField = settings.fieldMapping?.Word || 'Word';
  const fallbackField = 'Front';

  const words = new Set<string>();
  for (const note of notesInfo) {
    if (!note) continue;
    const value =
      note.fields[wordField]?.value || note.fields[fallbackField]?.value;
    if (value) {
      words.add(value.toLowerCase());
    }
  }

  wordCache.set(deckName, words);
  console.log(`[Anki] Word cache refreshed for "${deckName}": ${words.size} words`);
}

/**
 * Search for a word with fallback to the in-memory cache when Anki is offline.
 * Returns the same type as searchWord for compatibility.
 */
export async function searchWordCached(
  word: string,
  deckName: string
): Promise<AnkiNote | null> {
  try {
    return await searchWord(word, deckName);
  } catch {
    // Anki offline -- check the cache
    const cached = wordCache.get(deckName);
    if (cached && cached.has(word.toLowerCase())) {
      return {
        noteId: 0,
        modelName: '',
        tags: [],
        fields: {},
      };
    }
    return null;
  }
}

/**
 * Batch version of searchWordCached.
 */
export async function searchWordsCached(
  words: string[],
  deckName: string
): Promise<Map<string, AnkiNote>> {
  const results = new Map<string, AnkiNote>();
  const entries = await Promise.all(
    words.map(async (word) => {
      const note = await searchWordCached(word, deckName);
      return [word, note] as const;
    })
  );
  for (const [word, note] of entries) {
    if (note) {
      results.set(word, note);
    }
  }
  return results;
}

/** Add a word to the cache after successful card creation. */
export function addWordToCache(word: string, deckName: string): void {
  let cached = wordCache.get(deckName);
  if (!cached) {
    cached = new Set();
    wordCache.set(deckName, cached);
  }
  cached.add(word.toLowerCase());
}
