/**
 * GeminiSearchClient — Google Gemini web-grounded search
 *
 * Called for every chat question to provide web-grounded context to Nemotron.
 * Gemini retrieves web information; its output is passed as context into
 * Nemotron (the primary reasoning model).
 *
 * Includes a request queue so only one Gemini call runs at a time,
 * with a minimum 4-second gap between requests to avoid rate limits.
 *
 * API:   https://generativelanguage.googleapis.com/v1beta
 * Model: gemini-2.0-flash (free tier, supports Google Search grounding)
 * Auth:  API key via query parameter
 */

// Simple serial queue — one Gemini request at a time
let _lastRequestTime = 0;
const MIN_GAP_MS = 4000; // 4 seconds between requests

async function waitForSlot() {
  const now = Date.now();
  const elapsed = now - _lastRequestTime;
  if (elapsed < MIN_GAP_MS) {
    const wait = MIN_GAP_MS - elapsed;
    console.log(`[GeminiSearch] Throttling — waiting ${wait}ms before next request`);
    await new Promise((r) => setTimeout(r, wait));
  }
  _lastRequestTime = Date.now();
}

export class GeminiSearchClient {
  constructor(cfg) {
    this.apiKey = cfg.geminiApiKey;
    this.model = cfg.geminiModel || 'gemini-2.0-flash';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    if (!this.apiKey) {
      console.warn('[GeminiSearchClient] GEMINI_API_KEY not set — web search disabled.');
    }
  }

  get isAvailable() {
    return Boolean(this.apiKey);
  }

  /**
   * Perform a web-grounded search via Gemini.
   * Requests are serialized with a minimum gap to avoid rate limits.
   */
  async groundedSearch(query, countryName) {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured.');
    }

    // Wait for rate limit slot
    await waitForSlot();

    const prompt =
      `Find current, factual information to answer this question about ${countryName}:\n\n` +
      `"${query}"\n\n` +
      `Provide concise factual points. Include dates and source names where possible. ` +
      `Do not speculate. Only report what you find.`;

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    console.log(`[GeminiSearch] Querying: "${query.slice(0, 80)}" for ${countryName} (model: ${this.model})`);

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.3,
      },
    });

    // Retry up to 2 times on 429 with increasing backoff
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (res.ok) {
        const data = await res.json();
        return this._parseResponse(data);
      }

      if (res.status === 429 && attempt < maxRetries) {
        const waitSec = 15 * (attempt + 1); // 15s, 30s
        console.warn(`[GeminiSearch] Rate limited (429), retrying in ${waitSec}s (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        _lastRequestTime = Date.now();
        continue;
      }

      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }
  }

  /** Parse Gemini response, extracting text and grounding metadata. */
  _parseResponse(data) {
    const candidate = data.candidates?.[0];

    if (!candidate) {
      return { text: '', sources: [], searchQueries: [] };
    }

    const text = candidate.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join('\n') || '';

    const metadata = candidate.groundingMetadata || {};

    const sources = (metadata.groundingChunks || [])
      .filter((chunk) => chunk.web)
      .map((chunk) => ({
        title: chunk.web.title || 'Web Source',
        url: chunk.web.uri || '#',
        type: 'web',
      }));

    // Deduplicate by URL
    const seen = new Set();
    const uniqueSources = sources.filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });

    return {
      text,
      sources: uniqueSources,
      searchQueries: metadata.webSearchQueries || [],
    };
  }

  /** Health check */
  async healthCheck() {
    if (!this.apiKey) return false;
    try {
      const url = `${this.baseUrl}/models/${this.model}?key=${this.apiKey}`;
      const res = await fetch(url);
      return res.ok;
    } catch {
      return false;
    }
  }
}
