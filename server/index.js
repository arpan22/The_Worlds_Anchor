/**
 * News Globe — Backend Server
 *
 * Express server providing:
 *   GET  /api/news                           — NewsAPI proxy
 *   POST /api/country-session                — Create session + trigger Nemotron pipeline
 *   GET  /api/country-session/:id/status     — Poll brief status
 *   POST /api/country-session/:id/chat       — RAG chat (Nemotron + optional Gemini fallback)
 *
 * NVIDIA Integration (primary):
 *   NemotronClient → NVIDIA NIM (build.nvidia.com)
 *   Chat + summarization via Nemotron
 *   Embeddings via nvidia/nv-embedqa-e5-v5
 *
 * Gemini Integration (fallback only):
 *   GeminiSearchClient → Google Gemini (web-grounded search)
 *   Used ONLY when news context is insufficient
 *   Output compressed and fed as context into Nemotron
 */
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { NemotronClient } from './services/NemotronClient.js';
import { GeminiSearchClient } from './services/GeminiSearchClient.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import eventsRoutes from './routes/events.js';
import sessionRoutes from './routes/session.js';

const app = express();

// ─── Middleware ─────────────────────────────────────────────

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimiter({ windowMs: 60_000, maxRequests: 60 }));

// ─── NVIDIA Nemotron Client (primary reasoning model) ──────

const nemotron = new NemotronClient(config);
app.locals.nemotron = nemotron;

// ─── Google Gemini Client (web-grounded search fallback) ───

const gemini = new GeminiSearchClient(config);
app.locals.gemini = gemini;

// ─── Routes ────────────────────────────────────────────────

app.use('/api', eventsRoutes);
app.use('/api', sessionRoutes);

// Health check
app.get('/api/health', async (_req, res) => {
  const nvidiaOk = config.nvidiaApiKey ? await nemotron.healthCheck() : false;
  const geminiOk = config.geminiApiKey ? await gemini.healthCheck() : false;
  res.json({
    status: 'ok',
    nvidia: nvidiaOk ? 'connected' : 'unavailable',
    gemini: geminiOk ? 'connected' : 'unavailable',
    nemotronModel: config.nemotronModel,
    embeddingModel: config.embeddingModel,
    geminiModel: config.geminiModel,
    gdelt: 'free',
  });
});

// ─── Error handler ─────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start ─────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║           News Globe — Backend Server            ║
╠══════════════════════════════════════════════════╣
║  Port:       ${String(config.port).padEnd(35)}║
║  Nemotron:   ${config.nemotronModel.padEnd(35).slice(0, 35)}║
║  Embeddings: ${config.embeddingModel.padEnd(35).slice(0, 35)}║
║  Gemini:     ${config.geminiModel.padEnd(35).slice(0, 35)}║
║  GDELT:      ${'free, no key needed'.padEnd(35)}║
║  NVIDIA:     ${(config.nvidiaApiKey ? 'configured' : 'MISSING').padEnd(35)}║
║  Gemini key: ${(config.geminiApiKey ? 'configured' : 'MISSING').padEnd(35)}║
╚══════════════════════════════════════════════════╝
  `);
});

export default app;
