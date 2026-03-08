import { Router, type Response } from 'express';
import * as aiService from '../services/ai.js';
import * as ankiService from '../services/anki.js';
import { getSettings } from '../services/settings.js';
import { buildCardPreviews, type CardResponse } from '../services/cardExtraction.js';
import type { AnkiNote, ChatStreamRequest, RelemmatizeRequest, SSEEvent } from 'shared';
import { computeCost } from 'shared';
import { recordUsage } from '../services/session.js';

export const chatRouter = Router();

// Helper to send SSE events
function sendSSE(res: Response, event: SSEEvent): void {
  console.log(
    '[Chat] SSE:',
    event.type,
    typeof event.data === 'string' ? event.data.substring(0, 30) + '...' : event.data
  );
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Strip markdown code fences and parse JSON.
 */
export function parseJsonResponse(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '');
  return JSON.parse(stripped);
}

// POST /api/chat/stream - SSE endpoint for AI-generated card data
chatRouter.post('/stream', async (req, res) => {
  console.log('[Chat] POST /stream');
  const { newMessage, deck, highlightedWords, userContext, mode } = req.body as ChatStreamRequest;

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
  const prompts = aiService.getSystemPrompts(settings.showTransliteration);

  // Classify input
  const trimmedMessage = newMessage.trim();
  const isEnglishToBangla = mode === 'english-to-bangla';
  const isSingleWord = !trimmedMessage.includes(' ') && trimmedMessage.length < 30;
  const hasHighlightedWords = highlightedWords && highlightedWords.length > 0;

  // Sentence without highlights is blocked (unless English→Bangla mode)
  if (!isEnglishToBangla && !isSingleWord && !hasHighlightedWords) {
    sendSSE(res, {
      type: 'error',
      data: 'Sentence mode without highlighted words is not supported. Please highlight the words you want to learn.',
    });
    sendSSE(res, { type: 'done', data: null });
    res.end();
    return;
  }

  // Select prompt and build user message
  let systemPrompt: string;
  let userMessage: string;

  if (isEnglishToBangla && hasHighlightedWords) {
    // English sentence with highlighted words → disambiguated EN→BN lookup
    systemPrompt = prompts.englishToBangla;
    const rendered = aiService.renderUserTemplate(
      'englishToBangla',
      {
        sentence: newMessage,
        highlightedWords: highlightedWords.join(', '),
      },
      'focused'
    );
    userMessage =
      rendered || `Sentence: ${newMessage}\n\nFocus words: ${highlightedWords.join(', ')}`;
    console.log('[Chat] Using English→Bangla focused prompt for:', highlightedWords);
  } else if (isEnglishToBangla) {
    systemPrompt = prompts.englishToBangla;
    const rendered = aiService.renderUserTemplate('englishToBangla', {
      word: newMessage,
      userContext,
    });
    userMessage = rendered || newMessage;
    console.log('[Chat] Using English→Bangla prompt for:', newMessage);
  } else if (hasHighlightedWords) {
    systemPrompt = prompts.focusedWords;
    const rendered = aiService.renderUserTemplate('focusedWords', {
      sentence: newMessage,
      highlightedWords: highlightedWords.join(', '),
    });
    userMessage =
      rendered || `Sentence: ${newMessage}\n\nFocus words: ${highlightedWords.join(', ')}`;
    console.log('[Chat] Using focused words prompt for:', highlightedWords);
  } else {
    systemPrompt = prompts.word;
    const rendered = aiService.renderUserTemplate('word', {
      word: newMessage,
      userContext,
    });
    userMessage = rendered || newMessage;
  }

  // Pre-check Anki for input words (store full note for comparison UI)
  // For English→Bangla, we can't pre-check since we don't know the Bangla word yet
  const wordsToCheck = isEnglishToBangla
    ? []
    : hasHighlightedWords
      ? highlightedWords
      : [newMessage];
  const ankiResults = new Map<string, AnkiNote | null>();

  for (const word of wordsToCheck) {
    try {
      const existingNote = await ankiService.searchWordCached(word, targetDeck);
      ankiResults.set(word, existingNote);
    } catch (error) {
      console.warn('[Chat] Anki search failed:', error);
      ankiResults.set(word, null);
    }
  }

  try {
    // Single non-streaming AI call
    const { text: rawResponse, usage } = await aiService.getJsonCompletion(
      systemPrompt,
      userMessage
    );

    // Send usage event and record server-side
    if (usage) {
      sendSSE(res, { type: 'usage', data: usage });
      recordUsage(usage, computeCost(usage));
    }

    // Parse JSON response
    let cards: CardResponse[];
    try {
      const parsed = parseJsonResponse(rawResponse);
      // Single word returns an object, focused words returns an array
      cards = Array.isArray(parsed) ? (parsed as CardResponse[]) : [parsed as CardResponse];
    } catch {
      // Retry with healing prompt
      console.warn('[Chat] JSON parse failed, retrying with healing prompt');
      try {
        const { text: retryResponse, usage: retryUsage } = await aiService.getJsonCompletion(
          'Fix the following malformed JSON. Return ONLY valid JSON, nothing else.',
          rawResponse
        );
        if (retryUsage) {
          sendSSE(res, { type: 'usage', data: retryUsage });
          recordUsage(retryUsage, computeCost(retryUsage));
        }
        const parsed = parseJsonResponse(retryResponse);
        cards = Array.isArray(parsed) ? (parsed as CardResponse[]) : [parsed as CardResponse];
      } catch {
        sendSSE(res, { type: 'error', data: 'Failed to parse AI response as JSON' });
        sendSSE(res, { type: 'done', data: null });
        res.end();
        return;
      }
    }

    // Build card previews with Anki duplicate checks
    const cardPreviews = await buildCardPreviews(cards, targetDeck, ankiResults);

    for (const preview of cardPreviews) {
      sendSSE(res, { type: 'card_preview', data: preview });
    }

    sendSSE(res, { type: 'done', data: null });
    res.end();
  } catch (error) {
    console.error('[Chat] Unexpected error:', error);
    sendSSE(res, { type: 'error', data: String(error) });
    sendSSE(res, { type: 'done', data: null });
    res.end();
  }
});

// POST /api/chat/relemmatize - Re-check the dictionary form of a word
chatRouter.post('/relemmatize', async (req, res) => {
  const { word, sentence } = req.body as RelemmatizeRequest;

  if (!word) {
    res.status(400).json({ error: 'word is required' });
    return;
  }

  try {
    const prompt = aiService.getRelemmatizePrompt(word, sentence);

    const response = await aiService.getCompletion(prompt, word);

    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch {
      res.json({ lemma: word, definition: '' });
      return;
    }

    res.json({ lemma: parsed.lemma || word, definition: parsed.definition || '' });
  } catch (error) {
    console.error('[Chat] Error relemmatizing word:', error);
    res.status(500).json({ error: 'Failed to relemmatize word' });
  }
});
