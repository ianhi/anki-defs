import { Router, type Response } from 'express';
import * as aiService from '../services/ai.js';
import * as gemini from '../services/gemini.js';
import * as ankiService from '../services/anki.js';
import { getSettings } from '../services/settings.js';
import type {
  ChatStreamRequest,
  DefineRequest,
  AnalyzeRequest,
  RelemmatizeRequest,
  SSEEvent,
  AnkiNote,
} from 'shared';

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

// Extract vocabulary list from AI response (for sentence mode)
function extractVocabularyList(response: string): string[] {
  // Look for "**Vocabulary:**" line and extract comma-separated words
  const match = response.match(/\*\*Vocabulary:\*\*\s*([^\n]+)/i);
  if (!match || !match[1]) return [];

  return match[1]
    .split(',')
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !w.includes('*'));
}

// Extract sentence translation from AI response
function extractSentenceTranslation(response: string): string {
  // Look for "**Translation:**" or "**Sentence Translation:**" line
  const match = response.match(/\*\*(?:Sentence )?Translation:\*\*\s*([^\n]+)/i);
  return match?.[1]?.trim() || '';
}

// POST /api/chat/stream - SSE endpoint for streaming AI responses
chatRouter.post('/stream', async (req, res) => {
  console.log('[Chat] POST /stream');
  const { newMessage, deck, highlightedWords } = req.body as ChatStreamRequest;

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
  const trimmed = newMessage.trim();
  const isSingleWord = !trimmed.includes(' ') && trimmed.length < 30;
  const hasHighlightedWords = highlightedWords && highlightedWords.length > 0;

  // Select the appropriate prompt based on input type
  let systemPrompt: string;
  let userMessage: string;

  if (hasHighlightedWords) {
    systemPrompt = prompts.focusedWords;
    userMessage = `Sentence: ${newMessage}\n\nFocus words: ${highlightedWords.join(', ')}`;
    console.log('[Chat] Using focused words prompt for:', highlightedWords);
  } else if (isSingleWord) {
    systemPrompt = prompts.word;
    userMessage = newMessage;
  } else {
    systemPrompt = prompts.sentence;
    userMessage = newMessage;
  }

  // Check Anki for highlighted words or single word
  const wordsToCheck = hasHighlightedWords ? highlightedWords : isSingleWord ? [newMessage] : [];
  const ankiResults = new Map<string, boolean>();

  for (const word of wordsToCheck) {
    try {
      const existingNote = await ankiService.searchWord(word, targetDeck);
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
            // For sentences, extract vocabulary list from AI response
            wordsForCards = extractVocabularyList(fullResponse);
            console.log('[Chat] Extracted vocabulary from sentence:', wordsForCards);
          }

          // Check Anki for any words we haven't checked yet (sentence vocab)
          await Promise.all(
            wordsForCards
              .filter((word) => !ankiResults.has(word))
              .map(async (word) => {
                try {
                  const existingNote = await ankiService.searchWord(word, targetDeck);
                  ankiResults.set(word, !!existingNote);
                } catch (error) {
                  console.warn('[Chat] Anki search failed:', error);
                }
              })
          );

          // Use different extraction based on input type
          const useSentenceMode = !isSingleWord;
          const sentenceTranslation = useSentenceMode
            ? extractSentenceTranslation(fullResponse)
            : '';

          // Extract cards in parallel
          const results = await Promise.allSettled(
            wordsForCards.map(async (word) => {
              const cardData = useSentenceMode
                ? await gemini.extractCardDataFromSentence(
                    word,
                    newMessage, // original sentence as example
                    sentenceTranslation,
                    fullResponse
                  )
                : await gemini.extractCardData(word, fullResponse);
              return { word, cardData };
            })
          );

          // Check Anki for lemmatized words too (card extraction may return different lemma)
          await Promise.all(
            results.map(async (result) => {
              if (result.status !== 'fulfilled') return;
              const lemma = result.value.cardData.word;
              if (lemma !== result.value.word && !ankiResults.has(lemma)) {
                try {
                  const existingNote = await ankiService.searchWord(lemma, targetDeck);
                  ankiResults.set(lemma, !!existingNote);
                } catch (error) {
                  console.warn('[Chat] Anki lemma search failed:', error);
                }
              }
            })
          );

          for (const result of results) {
            if (result.status === 'fulfilled') {
              const { word, cardData } = result.value;
              const inflectedForm = cardData.word !== word ? word : undefined;
              const lemmaMismatch = cardData.word !== word;
              const exists = ankiResults.get(cardData.word) || ankiResults.get(word) || false;
              if (lemmaMismatch) {
                console.log('[Chat] Lemma mismatch: vocab=%s, extracted=%s', word, cardData.word);
              }
              sendSSE(res, {
                type: 'card_preview',
                data: {
                  ...cardData,
                  inflectedForm,
                  alreadyExists: exists,
                  lemmaMismatch,
                  originalLemma: lemmaMismatch ? word : undefined,
                },
              });
            } else {
              console.error('[Chat] Card extraction failed:', result.reason);
            }
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
    } catch (error) {
      console.warn('[Chat] Anki search failed:', error);
    }

    const prompts = aiService.getSystemPrompts(settings.showTransliteration);
    const response = await aiService.getCompletion(prompts.define, word);

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

// POST /api/chat/relemmatize - Re-check the dictionary form of a word
chatRouter.post('/relemmatize', async (req, res) => {
  const { word, sentence } = req.body as RelemmatizeRequest;

  if (!word) {
    res.status(400).json({ error: 'word is required' });
    return;
  }

  try {
    const context = sentence ? `\nContext sentence: ${sentence}` : '';
    const prompt = `What is the correct Bangla dictionary/lemma form of "${word}"?${context}

Return ONLY valid JSON:
{
  "lemma": "the dictionary form (verbal noun for verbs, bare noun without case endings, etc.)",
  "definition": "concise English definition (under 10 words)"
}

Bangla Lemmatization Rules:
- Nouns: Remove case endings. বাজারে→বাজার, বাজারের→বাজার, বাজারকে→বাজার
- Verbs: Convert to verbal noun. কাঁদতে→কাঁদা, যাব→যাওয়া, খাচ্ছি→খাওয়া, করেছিল→করা, গেছে→যাওয়া
- Adjectives: Use base form. বড়ো→বড়`;

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

    const prompts = aiService.getSystemPrompts(settings.showTransliteration);
    const response = await aiService.getCompletion(prompts.analyze, sentence);

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
    } catch (error) {
      console.warn('[Chat] Anki search failed:', error);
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
