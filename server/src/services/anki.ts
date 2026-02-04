import { YankiConnect } from 'yanki-connect';
import type { AnkiNote, CreateCardParams } from 'shared';
import { getSettings } from './settings.js';

let client: YankiConnect | null = null;

async function getClient(): Promise<YankiConnect> {
  if (!client) {
    const settings = await getSettings();
    client = new YankiConnect({ autoLaunch: false });
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
  return notesInfo.map((note) => ({
    noteId: note.noteId,
    modelName: note.modelName,
    tags: note.tags,
    fields: note.fields,
  }));
}

export async function searchWord(word: string, deckName: string): Promise<AnkiNote | null> {
  const query = `deck:"${deckName}" "${word}"`;
  const notes = await searchNotes(query);
  return notes.length > 0 ? notes[0] : null;
}

export async function searchWords(words: string[], deckName: string): Promise<Map<string, AnkiNote>> {
  const results = new Map<string, AnkiNote>();

  for (const word of words) {
    const note = await searchWord(word, deckName);
    if (note) {
      results.set(word, note);
    }
  }

  return results;
}

export async function getNoteById(noteId: number): Promise<AnkiNote | null> {
  const ankiClient = await getClient();
  const notesInfo = await ankiClient.note.notesInfo({ notes: [noteId] });
  if (notesInfo.length === 0) return null;

  const note = notesInfo[0];
  return {
    noteId: note.noteId,
    modelName: note.modelName,
    tags: note.tags,
    fields: note.fields,
  };
}

export async function createCard(params: CreateCardParams): Promise<number> {
  const ankiClient = await getClient();

  const noteId = await ankiClient.note.addNote({
    note: {
      deckName: params.deck,
      modelName: params.model,
      fields: {
        Word: params.word,
        Definition: params.definition,
        Example: params.exampleSentence,
        Translation: params.sentenceTranslation,
      },
      tags: params.tags || ['auto-generated'],
    },
  });

  return noteId;
}

export async function testConnection(): Promise<boolean> {
  try {
    const ankiClient = await getClient();
    await ankiClient.miscellaneous.version();
    return true;
  } catch {
    return false;
  }
}
