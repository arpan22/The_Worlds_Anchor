/**
 * Backend API Client
 *
 * Talks to the Express backend for:
 *   - News fetching (proxied through server to protect API key)
 *   - Country session creation (triggers Nemotron brief + RAG)
 *   - Session status polling
 *   - RAG-grounded chat
 *
 * In development, Vite proxies /api to the backend server (localhost:3001).
 */

const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling.
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.error || `API error: ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// ─── News ──────────────────────────────────────────────────

/**
 * Fetch news articles for a country.
 * GET /api/news?country=ca&category=...&q=...&hours=72
 */
export async function fetchNews({ country, countryName, category, q, hours = 72 }) {
  const params = new URLSearchParams({ country });
  if (countryName) params.append('countryName', countryName);
  if (category) params.append('category', category);
  if (q) params.append('q', q);
  if (hours) params.append('hours', String(hours));

  return apiFetch(`/news?${params}`);
}

// ─── Country Session ───────────────────────────────────────

/**
 * Create a country session (triggers Nemotron brief + RAG pipeline).
 * POST /api/country-session
 */
export async function createCountrySession(countryCode, countryName) {
  return apiFetch('/country-session', {
    method: 'POST',
    body: JSON.stringify({ countryCode, countryName }),
  });
}

/**
 * Poll session status.
 * GET /api/country-session/:sessionId/status
 *
 * Returns: { status, brief?, articleCount, error? }
 */
export async function getSessionStatus(sessionId) {
  return apiFetch(`/country-session/${sessionId}/status`);
}

/**
 * Send a chat message within a session.
 * POST /api/country-session/:sessionId/chat
 *
 * Returns: { reply, sources, sourceType }
 */
export async function sendChatMessage(sessionId, message, settings = {}) {
  return apiFetch(`/country-session/${sessionId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, settings }),
  });
}

/**
 * Health check.
 */
export async function checkHealth() {
  return apiFetch('/health');
}
