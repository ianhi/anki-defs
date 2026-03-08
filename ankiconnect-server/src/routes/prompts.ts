import { Router } from 'express';
import * as aiService from '../services/ai.js';
import { getSettings } from '../services/settings.js';

export const promptsRouter = Router();

// POST /api/prompts/preview — render prompts for a given input without calling the LLM
// Reloads prompt files from disk each time so edits are picked up without restart
promptsRouter.post('/preview', async (req, res) => {
  aiService.reloadPrompts();
  const {
    newMessage,
    highlightedWords,
    mode: requestMode,
  } = req.body as {
    newMessage: string;
    highlightedWords?: string[];
    mode?: string;
  };

  if (!newMessage) {
    res.status(400).json({ error: 'newMessage is required' });
    return;
  }

  const settings = await getSettings();
  const prompts = aiService.getSystemPrompts(settings.showTransliteration);

  const trimmedMessage = newMessage.trim();
  const isEnglishToBangla = requestMode === 'english-to-bangla';
  const isSingleWord = !trimmedMessage.includes(' ') && trimmedMessage.length < 30;
  const hasHighlightedWords = highlightedWords && highlightedWords.length > 0;

  let mode: string;
  let systemPrompt: string;
  let userMessage: string;

  if (isEnglishToBangla && hasHighlightedWords) {
    mode = 'english-to-bangla-focused';
    systemPrompt = prompts.englishToBanglaFocused;
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
  } else if (isEnglishToBangla) {
    mode = 'english-to-bangla';
    systemPrompt = prompts.englishToBangla;
    const rendered = aiService.renderUserTemplate('englishToBangla', { word: newMessage });
    userMessage = rendered || newMessage;
  } else if (hasHighlightedWords) {
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
    mode = 'sentence-blocked';
    systemPrompt = '';
    userMessage = newMessage;
  }

  res.json({
    mode,
    systemPrompt,
    userMessage,
  });
});
