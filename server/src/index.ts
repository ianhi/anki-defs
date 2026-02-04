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

import express from 'express';
import cors from 'cors';
import { ankiRouter } from './routes/anki.js';
import { chatRouter } from './routes/chat.js';
import { settingsRouter } from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/anki', ankiRouter);
app.use('/api/chat', chatRouter);
app.use('/api/settings', settingsRouter);

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
