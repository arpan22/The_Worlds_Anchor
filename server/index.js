/**
 * News Globe — Backend Server
 *
 * Express server providing:
 *   GET  /api/news                           — NewsAPI proxy
 *   POST /api/country-session                — Create session + trigger Nemotron pipeline
 *   GET  /api/country-session/:id/status     — Poll brief status
 *   POST /api/groq/chat                      — Standalone Groq chat
 *
 * NVIDIA Integration (primary):
 *   NemotronClient → NVIDIA NIM (build.nvidia.com)
 *   Chat + summarization via Nemotron
 *   Embeddings via nvidia/nv-embedqa-e5-v5
 *
 * Groq Integration:
 *   GroqClient → Groq standalone chat
 */
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { NemotronClient } from './services/NemotronClient.js';
import { GroqClient } from './services/GroqClient.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import eventsRoutes from './routes/events.js';
import sessionRoutes from './routes/session.js';
import groqRoutes from './routes/groq.js';

const app = express();

// ─── Middleware ─────────────────────────────────────────────

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimiter({ windowMs: 60_000, maxRequests: 60 }));

// ─── NVIDIA Nemotron Client (primary reasoning model) ──────

const nemotron = new NemotronClient(config);
app.locals.nemotron = nemotron;

// ─── Groq Client (standalone chat) ─────────────────────────

const groq = new GroqClient(config);
app.locals.groq = groq;

// ─── Routes ────────────────────────────────────────────────

app.use('/api', eventsRoutes);
app.use('/api', sessionRoutes);
app.use('/api', groqRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    nvidia: config.nvidiaApiKey ? 'configured' : 'unavailable',
    groq: config.groqApiKey ? 'configured' : 'unavailable',
    nemotronModel: config.nemotronModel,
    embeddingModel: config.embeddingModel,
    groqModel: config.groqModel,
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
║  Groq:       ${config.groqModel.padEnd(35).slice(0, 35)}║
║  GDELT:      ${'free, no key needed'.padEnd(35)}║
║  NVIDIA:     ${(config.nvidiaApiKey ? 'configured' : 'MISSING').padEnd(35)}║
║  Groq key:   ${(config.groqApiKey ? 'configured' : 'MISSING').padEnd(35)}║
╚══════════════════════════════════════════════════╝
  `);
});

export default app;
