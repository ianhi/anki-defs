import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');

// Load .env.local from project root
const envLocalPath = resolve(projectRoot, '.env.local');
const envPath = resolve(projectRoot, '.env');

console.log('[Server] Loading env from:', envLocalPath);
const result1 = config({ path: envLocalPath });
const result2 = config({ path: envPath });

console.log(
  '[Server] .env.local loaded:',
  result1.error ? 'FAILED: ' + result1.error.message : 'OK'
);
console.log('[Server] .env loaded:', result2.error ? 'FAILED: ' + result2.error.message : 'OK');
console.log('[Server] GEMINI_API_KEY set:', !!process.env.GEMINI_API_KEY);
console.log('[Server] AI_PROVIDER:', process.env.AI_PROVIDER);

import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { ankiRouter } from './routes/anki.js';
import { chatRouter } from './routes/chat.js';
import { settingsRouter } from './routes/settings.js';
import { sessionRouter } from './routes/session.js';
import { getSettings, saveSettings } from './services/settings.js';

const app = express();
const PORT = parseInt(String(process.env.PORT || 3001), 10);

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3001',
    ],
  })
);
app.use(express.json({ limit: '1mb' }));

// Bearer token auth middleware -- skip for localhost requests
app.use('/api', async (req, res, next) => {
  const remoteIp = req.ip || req.socket.remoteAddress || '';
  const isLocalhost =
    remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
  if (isLocalhost) {
    next();
    return;
  }

  const settings = await getSettings();
  if (!settings.apiToken) {
    // No token configured -- reject non-localhost requests
    res.status(401).json({ error: 'API token not configured' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${settings.apiToken}`) {
    res.status(401).json({ error: 'Invalid or missing API token' });
    return;
  }
  next();
});

// Routes
app.use('/api/anki', ankiRouter);
app.use('/api/chat', chatRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/session', sessionRouter);

// Platform info
app.get('/api/platform', (_req, res) => {
  res.json({ platform: 'web' });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = resolve(projectRoot, 'client', 'dist');
  app.use(express.static(clientDist));

  // SPA fallback - serve index.html for non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(resolve(clientDist, 'index.html'));
  });
}

// Generate API token on first startup
async function ensureApiToken() {
  const settings = await getSettings();
  if (!settings.apiToken) {
    const token = crypto.randomUUID();
    await saveSettings({ apiToken: token });
    console.log(`[Server] Generated API token: ${token}`);
  } else {
    console.log(`[Server] API token: ${settings.apiToken}`);
  }
}

ensureApiToken().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
