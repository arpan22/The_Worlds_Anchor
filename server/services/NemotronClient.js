/**
 * NemotronClient — NVIDIA NIM LLM Adapter
 *
 * Provides a clean interface to NVIDIA's inference services:
 *
 *   • Chat completions  → Nemotron model via NIM
 *   • Text embeddings   → NVIDIA embedding model via NIM
 *
 * API:  https://integrate.api.nvidia.com/v1  (OpenAI-compatible)
 * Auth: Bearer token (NVIDIA_API_KEY from build.nvidia.com)
 *
 * Models used:
 *   LLM:       nvidia/llama-3.1-nemotron-70b-instruct
 *   Embedding: nvidia/nv-embedqa-e5-v5
 */

export class NemotronClient {
  /**
   * @param {object} cfg
   * @param {string} cfg.nvidiaApiKey   - API key from build.nvidia.com
   * @param {string} cfg.nimEndpoint    - Base URL for NIM API
   * @param {string} cfg.nemotronModel  - Chat model identifier
   * @param {string} cfg.embeddingModel - Embedding model identifier
   */
  constructor(cfg) {
    this.apiKey = cfg.nvidiaApiKey;
    this.endpoint = cfg.nimEndpoint;
    this.model = cfg.nemotronModel;
    this.embeddingModel = cfg.embeddingModel;

    if (!this.apiKey) {
      console.warn('[NemotronClient] NVIDIA_API_KEY not set — LLM calls will fail.');
    }
  }

  // ─── Chat Completions (Nemotron) ────────────────────────────

  /**
   * Sends a chat completion request to Nemotron via NVIDIA NIM.
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} [options]
   * @param {number} [options.temperature=0.5]
   * @param {number} [options.maxTokens=2048]
   * @param {number} [options.topP=0.7]
   * @returns {Promise<string>} The assistant's reply content
   */
  async chatCompletion(messages, options = {}) {
    const { temperature = 0.5, maxTokens = 2048, topP = 0.7 } = options;

    const url = `${this.endpoint}/chat/completions`;
    const body = {
      model: this.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      stream: false,
    };

    console.log(`[NemotronClient] POST ${url}  model=${this.model}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Nemotron chat error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  /**
   * Streaming chat completion — yields delta tokens via a ReadableStream.
   * Uses the OpenAI-compatible SSE format from NVIDIA NIM.
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} [options]
   * @returns {Promise<ReadableStream>} Node-readable stream of SSE chunks
   */
  async chatCompletionStream(messages, options = {}) {
    const { temperature = 0.5, maxTokens = 2048, topP = 0.7 } = options;

    const url = `${this.endpoint}/chat/completions`;
    const body = {
      model: this.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      stream: true,
    };

    console.log(`[NemotronClient] STREAM POST ${url}  model=${this.model}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Nemotron stream error (${res.status}): ${errText}`);
    }

    return res.body; // Node ReadableStream of SSE data
  }

  // ─── Embeddings (NVIDIA NIM) ────────────────────────────────

  /**
   * Generates embeddings for an array of passage texts.
   * Uses input_type="passage" for document chunks.
   *
   * @param {string[]} texts  - Texts to embed (max ~50 per call)
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    if (texts.length === 0) return [];

    const url = `${this.endpoint}/embeddings`;
    const body = {
      model: this.embeddingModel,
      input: texts,
      input_type: 'passage',
      encoding_format: 'float',
      truncate: 'END',
    };

    console.log(`[NemotronClient] POST ${url}  model=${this.embeddingModel}  n=${texts.length}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`NVIDIA embedding error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.data.map((item) => item.embedding);
  }

  /**
   * Generates an embedding for a single query string.
   * Uses input_type="query" which is optimised for retrieval queries.
   *
   * @param {string} query
   * @returns {Promise<number[]>} Embedding vector
   */
  async generateQueryEmbedding(query) {
    const url = `${this.endpoint}/embeddings`;
    const body = {
      model: this.embeddingModel,
      input: [query],
      input_type: 'query',
      encoding_format: 'float',
      truncate: 'END',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`NVIDIA query-embedding error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
  }

  /**
   * Health check — verifies the API key works by hitting the models list.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const res = await fetch(`${this.endpoint}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
