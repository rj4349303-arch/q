import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRouter from './routes/chat.js';
import authRouter from './routes/auth.js';
import chatsRouter from './routes/chats.js';

// Setup __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve static website files (introduction website)
app.use('/website', express.static(path.join(__dirname, '../website')));

// API Routes
app.use('/api/chat', chatRouter);
app.use('/api/auth', authRouter);
app.use('/api/chats', chatsRouter);

// Fallback to index.html for single-page routing if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Qualm AI Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
