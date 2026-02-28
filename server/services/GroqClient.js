/**
 * GroqClient — standalone chat client for Groq's OpenAI-compatible API.
 */

let lastRequestTime = 0;
const MIN_GAP_MS = 1500;

async function waitForSlot() {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < MIN_GAP_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_GAP_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export class GroqClient {
  constructor(cfg) {
    this.apiKey = cfg.groqApiKey;
    this.model = cfg.groqModel || 'llama-3.1-8b-instant';
    this.baseUrl = 'https://api.groq.com/openai/v1';

    if (!this.apiKey) {
      console.warn('[GroqClient] GROQ_API_KEY not set — chat disabled.');
    }
  }

  get isAvailable() {
    return Boolean(this.apiKey);
  }

  async chatCompletion(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('Groq API key not configured.');
    }

    const { temperature = 0.6, maxTokens = 300, topP = 0.9 } = options;
    const url = `${this.baseUrl}/chat/completions`;
    const body = JSON.stringify({
      model: this.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      stream: false,
    });

    await waitForSlot();

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content?.trim();
        if (!reply) {
          throw new Error('Groq returned an empty response.');
        }
        return reply;
      }

      const errText = await res.text();
      if (res.status === 429 && attempt < maxRetries) {
        const delayMs = 2000 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        lastRequestTime = Date.now();
        continue;
      }

      throw new Error(this.formatError(res.status, errText));
    }
  }

  formatError(status, errText) {
    let parsed = null;

    try {
      parsed = JSON.parse(errText);
    } catch {
      parsed = null;
    }

    const providerMessage = parsed?.error?.message?.trim();

    if (status === 429) {
      return 'Groq rate limit reached. Please retry shortly.';
    }

    return providerMessage
      ? `Groq API error (${status}): ${providerMessage}`
      : `Groq API error (${status}).`;
  }
}
