import { Router } from 'express';
import * as aiService from '../services/ai.js';
import { getSettings } from '../services/settings.js';

export const promptsRouter = Router();

// POST /api/prompts/preview — render prompts for a given input without calling the LLM
promptsRouter.post('/preview', async (req, res) => {
  const { newMessage, highlightedWords } = req.body as {
    newMessage: string;
    highlightedWords?: string[];
  };

  if (!newMessage) {
    res.status(400).json({ error: 'newMessage is required' });
    return;
  }

  const settings = await getSettings();
  const prompts = aiService.getSystemPrompts(settings.showTransliteration);

  const trimmedMessage = newMessage.trim();
  const isSingleWord = !trimmedMessage.includes(' ') && trimmedMessage.length < 30;
  const hasHighlightedWords = highlightedWords && highlightedWords.length > 0;

  let mode: string;
  let systemPrompt: string;
  let userMessage: string;

  if (hasHighlightedWords) {
    mode = 'focused-words';
    systemPrompt = prompts.focusedWords;
    const rendered = aiService.renderUserTemplate('focusedWords', {
      sentence: newMessage,
      highlightedWords: highlightedWords.join(', '),
    });
    userMessage =
      rendered || `Sentence: ${newMessage}\n\nFocus words: ${highlightedWords.join(', ')}`;
  } else if (isSingleWord) {
    mode = 'single-word';
    systemPrompt = prompts.word;
    const rendered = aiService.renderUserTemplate('word', { word: newMessage });
    userMessage = rendered || newMessage;
  } else {
    mode = 'sentence';
    systemPrompt = prompts.sentence;
    const rendered = aiService.renderUserTemplate('sentence', { sentence: newMessage });
    userMessage = rendered || newMessage;
  }

  // Also show card extraction prompt (used as second LLM call)
  const extractionSystemPrompt = prompts.extractCard;

  res.json({
    mode,
    systemPrompt,
    userMessage,
    extractionSystemPrompt,
  });
});
