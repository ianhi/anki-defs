import { Router } from 'express';
import * as sessionService from '../services/session.js';
import { searchHistory } from '../services/session.js';
import type { SessionCard, PendingCard } from 'shared';
import { getUsageTotals, clearUsage } from '../services/session.js';

export const sessionRouter = Router();

// GET /api/session - Get full session state
sessionRouter.get('/', async (_req, res) => {
  try {
    const state = await sessionService.getState();
    res.json(state);
  } catch (error) {
    console.error('[Session] Error getting state:', error);
    res.status(500).json({ error: 'Failed to get session state' });
  }
});

// POST /api/session/cards - Add a card
sessionRouter.post('/cards', async (req, res) => {
  const card = req.body as SessionCard;
  if (!card.id || !card.word) {
    res.status(400).json({ error: 'id and word are required' });
    return;
  }
  try {
    await sessionService.addCard(card);
    res.json({ success: true });
  } catch (error) {
    console.error('[Session] Error adding card:', error);
    res.status(500).json({ error: 'Failed to add card' });
  }
});

// DELETE /api/session/cards/:id - Remove a card
sessionRouter.delete('/cards/:id', async (req, res) => {
  try {
    const removed = await sessionService.removeCard(req.params.id);
    res.json({ success: removed });
  } catch (error) {
    console.error('[Session] Error removing card:', error);
    res.status(500).json({ error: 'Failed to remove card' });
  }
});

// POST /api/session/pending - Add to pending queue
sessionRouter.post('/pending', async (req, res) => {
  const card = req.body as PendingCard;
  if (!card.id || !card.word) {
    res.status(400).json({ error: 'id and word are required' });
    return;
  }
  try {
    await sessionService.addPending(card);
    res.json({ success: true });
  } catch (error) {
    console.error('[Session] Error adding pending card:', error);
    res.status(500).json({ error: 'Failed to add pending card' });
  }
});

// DELETE /api/session/pending/:id - Remove from pending queue
sessionRouter.delete('/pending/:id', async (req, res) => {
  try {
    const removed = await sessionService.removePending(req.params.id);
    res.json({ success: removed });
  } catch (error) {
    console.error('[Session] Error removing pending card:', error);
    res.status(500).json({ error: 'Failed to remove pending card' });
  }
});

// POST /api/session/pending/:id/promote - Sync pending card to Anki and move to cards
sessionRouter.post('/pending/:id/promote', async (req, res) => {
  const { noteId } = req.body as { noteId: number };
  if (!noteId) {
    res.status(400).json({ error: 'noteId is required' });
    return;
  }
  try {
    const card = await sessionService.promotePending(req.params.id, noteId);
    if (!card) {
      res.status(404).json({ error: 'Pending card not found' });
      return;
    }
    res.json({ success: true, card });
  } catch (error) {
    console.error('[Session] Error promoting pending card:', error);
    res.status(500).json({ error: 'Failed to promote pending card' });
  }
});

// POST /api/session/clear - Clear all session data
sessionRouter.post('/clear', async (_req, res) => {
  try {
    await sessionService.clearAll();
    res.json({ success: true });
  } catch (error) {
    console.error('[Session] Error clearing session:', error);
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

// GET /api/session/usage - Get cumulative token usage
sessionRouter.get('/usage', (_req, res) => {
  try {
    res.json(getUsageTotals());
  } catch (error) {
    console.error('[Session] Error getting usage:', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

// POST /api/session/usage/reset - Reset usage counters
sessionRouter.post('/usage/reset', (_req, res) => {
  try {
    clearUsage();
    res.json({ success: true });
  } catch (error) {
    console.error('[Session] Error resetting usage:', error);
    res.status(500).json({ error: 'Failed to reset usage' });
  }
});

// GET /api/session/history - Search past card history
sessionRouter.get('/history', (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset)) || 0, 0);
    const result = searchHistory(q, limit, offset);
    res.json(result);
  } catch (error) {
    console.error('[Session] Error searching history:', error);
    res.status(500).json({ error: 'Failed to search history' });
  }
});
