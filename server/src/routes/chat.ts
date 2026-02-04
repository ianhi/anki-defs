import { Router, type Response } from 'express';
import * as aiService from '../services/ai.js';
import * as ankiService from '../services/anki.js';
import { getSettings } from '../services/settings.js';
import type { ChatStreamRequest, DefineRequest, AnalyzeRequest, SSEEvent, AnkiNote } from 'shared';

export const chatRouter = Router();

interface ParsedWord {
  word: string;
  lemma: string;
  partOfSpeech: string;
  meaning: string;
}

// Helper to send SSE events
function sendSSE(res: Response, event: SSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// POST /api/chat/stream - SSE endpoint for streaming AI responses
chatRouter.post('/stream', async (req, res) => {
  const { newMessage, deck } = req.body as ChatStreamRequest;

  if (!newMessage) {
    res.status(400).json({ error: 'newMessage is required' });
    return;
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const settings = await getSettings();
  const targetDeck = deck || settings.defaultDeck;

  // Check if it looks like a single word (for Anki lookup)
  const isSingleWord = !newMessage.includes(' ') && newMessage.length < 30;

  if (isSingleWord) {
    try {
      const existingNote = await ankiService.searchWord(newMessage, targetDeck);
      if (existingNote) {
        sendSSE(res, {
          type: 'text',
          data: `I found "${newMessage}" in your deck "${targetDeck}".\n\n`,
        });
      }
    } catch {
      // Anki not available, continue without check
    }
  }

  // Stream AI response
  await aiService.streamCompletion(aiService.SYSTEM_PROMPTS.chat, newMessage, {
    onText: (text) => {
      sendSSE(res, { type: 'text', data: text });
    },
    onDone: () => {
      sendSSE(res, { type: 'done', data: null });
      res.end();
    },
    onError: (error) => {
      sendSSE(res, { type: 'error', data: error.message });
      res.end();
    },
  });
});

// POST /api/chat/define - Get definition for a word (non-streaming)
chatRouter.post('/define', async (req, res) => {
  const { word, deck } = req.body as DefineRequest;

  if (!word) {
    res.status(400).json({ error: 'word is required' });
    return;
  }

  try {
    const settings = await getSettings();
    const targetDeck = deck || settings.defaultDeck;

    // Check if word exists in Anki
    let existsInAnki = false;
    let noteId: number | undefined;

    try {
      const existingNote = await ankiService.searchWord(word, targetDeck);
      if (existingNote) {
        existsInAnki = true;
        noteId = existingNote.noteId;
      }
    } catch {
      // Anki not available
    }

    // Get AI definition
    const response = await aiService.getCompletion(aiService.SYSTEM_PROMPTS.define, word);

    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch {
      // If not valid JSON, return raw response
      res.json({
        word,
        definition: response,
        existsInAnki,
        noteId,
      });
      return;
    }

    res.json({
      ...parsed,
      existsInAnki,
      noteId,
    });
  } catch (error) {
    console.error('Error defining word:', error);
    res.status(500).json({ error: 'Failed to get definition' });
  }
});

// POST /api/chat/analyze - Analyze sentence, identify unknown words
chatRouter.post('/analyze', async (req, res) => {
  const { sentence, deck } = req.body as AnalyzeRequest;

  if (!sentence) {
    res.status(400).json({ error: 'sentence is required' });
    return;
  }

  try {
    const settings = await getSettings();
    const targetDeck = deck || settings.defaultDeck;

    // Get AI analysis
    const response = await aiService.getCompletion(aiService.SYSTEM_PROMPTS.analyze, sentence);

    let parsed: { translation?: string; words?: ParsedWord[]; grammar?: string };
    try {
      parsed = JSON.parse(response);
    } catch {
      res.json({
        originalSentence: sentence,
        translation: response,
        words: [],
      });
      return;
    }

    // Check which words exist in Anki
    const words = parsed.words || [];
    const lemmas = words.map((w) => w.lemma);

    let ankiResults = new Map<string, AnkiNote>();
    try {
      ankiResults = await ankiService.searchWords(lemmas, targetDeck);
    } catch {
      // Anki not available
    }

    // Add Anki status to each word
    const enrichedWords = words.map((w) => ({
      ...w,
      existsInAnki: ankiResults.has(w.lemma),
      noteId: ankiResults.get(w.lemma)?.noteId,
    }));

    res.json({
      originalSentence: sentence,
      translation: parsed.translation,
      words: enrichedWords,
      grammar: parsed.grammar,
    });
  } catch (error) {
    console.error('Error analyzing sentence:', error);
    res.status(500).json({ error: 'Failed to analyze sentence' });
  }
});
