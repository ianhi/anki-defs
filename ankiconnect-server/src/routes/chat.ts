import { Router, type Response } from 'express';
import * as aiService from '../services/ai.js';
import * as ankiService from '../services/anki.js';
import { getSettings } from '../services/settings.js';
import {
  extractCards,
  extractVocabularyList,
  extractSentenceTranslation,
  extractInflectedForms,
} from '../services/cardExtraction.js';
import type { ChatStreamRequest, RelemmatizeRequest, SSEEvent } from 'shared';

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

// POST /api/chat/stream - SSE endpoint for streaming AI responses
chatRouter.post('/stream', async (req, res) => {
  console.log('[Chat] POST /stream');
  const { newMessage, deck, highlightedWords, userContext } = req.body as ChatStreamRequest;

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

  // Determine if this is a single word or a sentence/phrase
  const isSingleWord = !newMessage.includes(' ') && newMessage.length < 30;
  const hasHighlightedWords = highlightedWords && highlightedWords.length > 0;

  // Select the appropriate prompt based on input type
  let systemPrompt: string;
  let userMessage: string;

  if (hasHighlightedWords) {
    systemPrompt = prompts.focusedWords;
    const rendered = aiService.renderUserTemplate('focusedWords', {
      sentence: newMessage,
      highlightedWords: highlightedWords.join(', '),
    });
    userMessage =
      rendered || `Sentence: ${newMessage}\n\nFocus words: ${highlightedWords.join(', ')}`;
    console.log('[Chat] Using focused words prompt for:', highlightedWords);
  } else if (isSingleWord) {
    systemPrompt = prompts.word;
    const rendered = aiService.renderUserTemplate('word', {
      word: newMessage,
      userContext,
    });
    userMessage = rendered || newMessage;
  } else {
    systemPrompt = prompts.sentence;
    const rendered = aiService.renderUserTemplate('sentence', {
      sentence: newMessage,
      userContext,
    });
    userMessage = rendered || newMessage;
  }

  // Check Anki for highlighted words or single word
  const wordsToCheck = hasHighlightedWords ? highlightedWords : isSingleWord ? [newMessage] : [];
  const ankiResults = new Map<string, boolean>();

  for (const word of wordsToCheck) {
    try {
      const existingNote = await ankiService.searchWordCached(word, targetDeck);
      ankiResults.set(word, !!existingNote);
    } catch (error) {
      console.warn('[Chat] Anki search failed:', error);
    }
  }

  // Collect the full response for card extraction
  let fullResponse = '';

  // Stream AI response
  try {
    await aiService.streamCompletion(systemPrompt, userMessage, {
      onText: (text) => {
        fullResponse += text;
        sendSSE(res, { type: 'text', data: text });
      },
      onUsage: (usage) => {
        sendSSE(res, { type: 'usage', data: usage });
      },
      onDone: async () => {
        try {
          console.log('[Chat] Stream done, extracting card data...');

          // Determine which words to generate cards for
          let wordsForCards: string[];
          if (hasHighlightedWords) {
            wordsForCards = highlightedWords;
          } else if (isSingleWord) {
            wordsForCards = [newMessage];
          } else {
            wordsForCards = extractVocabularyList(fullResponse);
            console.log('[Chat] Extracted vocabulary from sentence:', wordsForCards);
          }

          const isSentenceMode = !isSingleWord;
          const sentenceTranslation = isSentenceMode
            ? extractSentenceTranslation(fullResponse)
            : '';

          // Extract inflected→lemma mappings for sentence highlighting
          // Needed for both sentence and focused-words modes — user may
          // highlight a lemma form that differs from the inflected form in the sentence
          const inflectedForms = isSentenceMode ? extractInflectedForms(fullResponse) : undefined;

          const settings2 = await getSettings();
          const { cardPreviews, errors, totalUsage } = await extractCards({
            wordsForCards,
            fullResponse,
            originalSentence: newMessage,
            sentenceTranslation,
            isSentenceMode,
            targetDeck,
            ankiResults,
            inflectedForms,
          });

          for (const preview of cardPreviews) {
            sendSSE(res, { type: 'card_preview', data: preview });
          }
          for (const error of errors) {
            sendSSE(res, { type: 'error', data: error });
          }
          if (totalUsage) {
            sendSSE(res, {
              type: 'usage',
              data: {
                inputTokens: totalUsage.inputTokens,
                outputTokens: totalUsage.outputTokens,
                provider: 'gemini',
                model: settings2.geminiModel || 'gemini-2.5-flash-lite',
              },
            });
          }
        } catch (error) {
          console.error('[Chat] Error in onDone handler:', error);
          sendSSE(res, { type: 'error', data: String(error) });
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
