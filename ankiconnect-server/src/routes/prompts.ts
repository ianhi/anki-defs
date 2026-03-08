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

  const { mode, systemPrompt, userMessage } = aiService.selectPrompt(prompts, newMessage, {
    highlightedWords,
    mode: requestMode,
  });

  res.json({ mode, systemPrompt, userMessage });
});
