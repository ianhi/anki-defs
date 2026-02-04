import { Router } from 'express';
import * as settingsService from '../services/settings.js';
import { resetClients } from '../services/ai.js';
import type { Settings } from 'shared';

export const settingsRouter = Router();

// GET /api/settings - Get current settings
settingsRouter.get('/', async (_req, res) => {
  try {
    const settings = await settingsService.getSettings();
    // Don't expose full API keys
    const sanitized = {
      ...settings,
      claudeApiKey: settings.claudeApiKey ? '••••••••' + settings.claudeApiKey.slice(-4) : '',
      geminiApiKey: settings.geminiApiKey ? '••••••••' + settings.geminiApiKey.slice(-4) : '',
    };
    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Update settings
settingsRouter.put('/', async (req, res) => {
  try {
    const updates = req.body as Partial<Settings>;

    // If API keys are masked, don't update them
    if (updates.claudeApiKey?.startsWith('••••')) {
      delete updates.claudeApiKey;
    }
    if (updates.geminiApiKey?.startsWith('••••')) {
      delete updates.geminiApiKey;
    }

    const updated = await settingsService.saveSettings(updates);

    // Reset AI clients if provider or keys changed
    if (updates.aiProvider || updates.claudeApiKey || updates.geminiApiKey) {
      resetClients();
    }

    // Don't expose full API keys in response
    const sanitized = {
      ...updated,
      claudeApiKey: updated.claudeApiKey ? '••••••••' + updated.claudeApiKey.slice(-4) : '',
      geminiApiKey: updated.geminiApiKey ? '••••••••' + updated.geminiApiKey.slice(-4) : '',
    };

    res.json(sanitized);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});
