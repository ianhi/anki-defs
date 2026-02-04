import { Router, type Response } from 'express';
import * as aiService from '../services/ai.js';
import * as gemini from '../services/gemini.js';
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
  console.log(
    '[Chat] SSE:',
    event.type,
    typeof event.data === 'string' ? event.data.substring(0, 30) + '...' : event.data
  );
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// POST /api/chat/stream - SSE endpoint for streaming AI responses
chatRouter.post('/stream', async (req, res) => {
  console.log('[Chat] POST /stream');
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

  // Determine if this is a single word or a sentence/phrase
  const trimmed = newMessage.trim();
  const isSingleWord = !trimmed.includes(' ') && trimmed.length < 30;

  // Select the appropriate prompt based on input type
  const systemPrompt = isSingleWord
    ? aiService.SYSTEM_PROMPTS.word
    : aiService.SYSTEM_PROMPTS.sentence;

  let wordExistsInAnki = false;

  if (isSingleWord) {
    try {
      const existingNote = await ankiService.searchWord(newMessage, targetDeck);
      if (existingNote) {
        wordExistsInAnki = true;
        // Don't show the "already in deck" message inline - handle in card preview
      }
    } catch {
      // Anki not available
    }
  }

  // Collect the full response for card extraction
  let fullResponse = '';

  // Stream AI response
  try {
    await aiService.streamCompletion(systemPrompt, newMessage, {
      onText: (text) => {
        fullResponse += text;
        sendSSE(res, { type: 'text', data: text });
      },
      onDone: async () => {
        console.log('[Chat] Stream done, extracting card data...');

        // Extract card data for single words (even if exists - let user decide)
        if (isSingleWord) {
          try {
            const cardData = await gemini.extractCardData(newMessage, fullResponse);
            sendSSE(res, {
              type: 'card_preview',
              data: {
                ...cardData,
                alreadyExists: wordExistsInAnki,
              },
            });
          } catch (error) {
            console.error('[Chat] Card extraction failed:', error);
            // Don't fail the whole request, just skip card preview
          }
        }

        sendSSE(res, { type: 'done', data: null });
        res.end();
      },
      onError: (error) => {
        console.error('[Chat] Stream error:', error);
        sendSSE(res, { type: 'error', data: error.message });
        res.end();
      },
    });
  } catch (error) {
    console.error('[Chat] Unexpected error:', error);
    sendSSE(res, { type: 'error', data: String(error) });
    res.end();
  }
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

    const response = await aiService.getCompletion(aiService.SYSTEM_PROMPTS.define, word);

    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch {
      res.json({ word, definition: response, existsInAnki, noteId });
      return;
    }

    res.json({ ...parsed, existsInAnki, noteId });
  } catch (error) {
    console.error('[Chat] Error defining word:', error);
    res.status(500).json({ error: 'Failed to get definition' });
  }
});

// POST /api/chat/analyze - Analyze sentence
chatRouter.post('/analyze', async (req, res) => {
  const { sentence, deck } = req.body as AnalyzeRequest;

  if (!sentence) {
    res.status(400).json({ error: 'sentence is required' });
    return;
  }

  try {
    const settings = await getSettings();
    const targetDeck = deck || settings.defaultDeck;

    const response = await aiService.getCompletion(aiService.SYSTEM_PROMPTS.analyze, sentence);

    let parsed: { translation?: string; words?: ParsedWord[]; grammar?: string };
    try {
      parsed = JSON.parse(response);
    } catch {
      res.json({ originalSentence: sentence, translation: response, words: [] });
      return;
    }

    const words = parsed.words || [];
    const lemmas = words.map((w) => w.lemma);

    let ankiResults = new Map<string, AnkiNote>();
    try {
      ankiResults = await ankiService.searchWords(lemmas, targetDeck);
    } catch {
      // Anki not available
    }

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
    console.error('[Chat] Error analyzing sentence:', error);
    res.status(500).json({ error: 'Failed to analyze sentence' });
  }
});
