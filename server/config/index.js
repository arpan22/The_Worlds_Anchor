/**
 * Server Configuration
 *
 * Loads environment variables and exports a typed config object.
 * All NVIDIA NIM / Nemotron and Groq settings are centralized here.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),

  // GDELT (free, no API key required)
  gdeltDocBaseUrl: 'https://api.gdeltproject.org/api/v2/doc/doc',
  gdeltCacheTtlMs: 8 * 60 * 1000,

  // NVIDIA NIM / Nemotron (primary reasoning model)
  nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
  nimEndpoint: process.env.NIM_ENDPOINT || 'https://integrate.api.nvidia.com/v1',
  nemotronModel: process.env.NEMOTRON_MODEL || 'nvidia/llama-3.3-nemotron-super-49b-v1',
  embeddingModel: process.env.NVIDIA_EMBED_MODEL || 'nvidia/nv-embedqa-e5-v5',

  // Groq (standalone chat)
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',

  // Session
  sessionTtlMs: 10 * 60 * 1000, // 10 minutes default

  // RAG
  ragTopK: 12,
  ragChunkSize: 500,
  ragChunkOverlap: 50,

  // Token budgets (hard caps)
  defaults: {
    groqMaxOutputTokens: 300,
    nemotronMaxContextTokens: 4000,
    cacheDurationMinutes: 10,
  },
};
