import { YankiConnect } from 'yanki-connect';
import type { AnkiNote, CreateCardParams } from 'shared';

let client: YankiConnect | null = null;

function getClient(): YankiConnect {
  if (!client) {
    client = new YankiConnect({ autoLaunch: false });
  }
  return client;
}

export async function getDecks(): Promise<string[]> {
  const ankiClient = getClient();
  return ankiClient.deck.deckNames();
}

export async function getModels(): Promise<string[]> {
  const ankiClient = getClient();
  return ankiClient.model.modelNames();
}

export async function getModelFields(modelName: string): Promise<string[]> {
  const ankiClient = getClient();
  return ankiClient.model.modelFieldNames({ modelName });
}

export async function searchNotes(query: string): Promise<AnkiNote[]> {
  const ankiClient = getClient();
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
  const query = `deck:"${deckName}" "${word}"`;
  const notes = await searchNotes(query);
  return notes[0] ?? null;
}

export async function searchWords(
  words: string[],
  deckName: string
): Promise<Map<string, AnkiNote>> {
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
  const ankiClient = getClient();
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
  const ankiClient = getClient();

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

  if (noteId === null) {
    throw new Error('Failed to create note - duplicate or invalid');
  }

  return noteId;
}

export async function testConnection(): Promise<boolean> {
  try {
    const ankiClient = getClient();
    await ankiClient.miscellaneous.version();
    return true;
  } catch {
    return false;
  }
}
