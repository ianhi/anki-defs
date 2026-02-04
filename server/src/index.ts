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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
