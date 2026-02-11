/**
 * Server Configuration
 *
 * Loads environment variables and exports a typed config object.
 * All NVIDIA NIM / Nemotron and Gemini settings are centralized here.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),

  // NewsAPI
  newsApiKey: process.env.NEWS_API_KEY || '',
  newsApiBaseUrl: 'https://newsapi.org/v2',

  // NVIDIA NIM / Nemotron (primary reasoning model)
  nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
  nimEndpoint: process.env.NIM_ENDPOINT || 'https://integrate.api.nvidia.com/v1',
  nemotronModel: process.env.NEMOTRON_MODEL || 'nvidia/llama-3.3-nemotron-super-49b-v1',
  embeddingModel: process.env.NVIDIA_EMBED_MODEL || 'nvidia/nv-embedqa-e5-v5',

  // Google Gemini (web-grounded search fallback ONLY)
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',

  // Session
  sessionTtlMs: 10 * 60 * 1000, // 10 minutes default

  // RAG
  ragTopK: 12,
  ragChunkSize: 500,
  ragChunkOverlap: 50,

  // Token budgets (hard caps)
  defaults: {
    geminiMaxInputTokens: 2000,
    geminiMaxOutputTokens: 1000,
    nemotronMaxContextTokens: 4000,
    geminiEnabled: true,
    cacheDurationMinutes: 10,
  },

  // Confidence threshold — below this, Gemini fallback triggers
  ragConfidenceThreshold: 0.25,
};
