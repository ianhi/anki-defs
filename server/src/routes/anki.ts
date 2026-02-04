import { Router } from 'express';
import * as ankiService from '../services/anki.js';
import type { SearchNotesRequest, CreateNoteRequest } from 'shared';

export const ankiRouter = Router();

// GET /api/anki/decks - List all deck names
ankiRouter.get('/decks', async (_req, res) => {
  try {
    const decks = await ankiService.getDecks();
    res.json({ decks });
  } catch (error) {
    console.error('Error fetching decks:', error);
    res.status(500).json({ error: 'Failed to fetch decks. Is Anki running?' });
  }
});

// GET /api/anki/models - List all note types
ankiRouter.get('/models', async (_req, res) => {
  try {
    const models = await ankiService.getModels();
    res.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models. Is Anki running?' });
  }
});

// GET /api/anki/models/:name/fields - Get fields for a note type
ankiRouter.get('/models/:name/fields', async (req, res) => {
  try {
    const fields = await ankiService.getModelFields(req.params.name);
    res.json({ fields });
  } catch (error) {
    console.error('Error fetching model fields:', error);
    res.status(500).json({ error: 'Failed to fetch model fields' });
  }
});

// POST /api/anki/search - Search notes by query
ankiRouter.post('/search', async (req, res) => {
  try {
    const { query } = req.body as SearchNotesRequest;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    const notes = await ankiService.searchNotes(query);
    res.json({ notes });
  } catch (error) {
    console.error('Error searching notes:', error);
    res.status(500).json({ error: 'Failed to search notes' });
  }
});

// POST /api/anki/notes - Create a new note/card
ankiRouter.post('/notes', async (req, res) => {
  try {
    const { deckName, modelName, fields, tags } = req.body as CreateNoteRequest;

    if (!deckName || !modelName || !fields) {
      res.status(400).json({ error: 'deckName, modelName, and fields are required' });
      return;
    }

    const noteId = await ankiService.createCard({
      deck: deckName,
      model: modelName,
      word: fields.Word || '',
      definition: fields.Definition || '',
      exampleSentence: fields.Example || '',
      sentenceTranslation: fields.Translation || '',
      tags,
    });

    res.json({ noteId });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// GET /api/anki/notes/:id - Get note details
ankiRouter.get('/notes/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    if (isNaN(noteId)) {
      res.status(400).json({ error: 'Invalid note ID' });
      return;
    }

    const note = await ankiService.getNoteById(noteId);
    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.json({ note });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// GET /api/anki/status - Check AnkiConnect status
ankiRouter.get('/status', async (_req, res) => {
  try {
    const connected = await ankiService.testConnection();
    res.json({ connected });
  } catch {
    res.json({ connected: false });
  }
});
