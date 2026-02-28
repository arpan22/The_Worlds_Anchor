/**
 * Backend API Client
 *
 * Talks to the Express backend for:
 *   - GDELT events fetching (country news via GDELT)
 *   - Country session creation (triggers Nemotron brief + RAG)
 *   - Session status polling
 *   - RAG-grounded chat
 *   - Graph and timeline generation
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

// ─── GDELT Events ──────────────────────────────────────────

/**
 * Fetch GDELT events for a country.
 * GET /api/events?country=us&countryName=United+States&dateRange=7d&tone=all&eventType=all
 */
export async function fetchEvents({ country, countryName, dateRange = '7d', tone = 'all', eventType = 'all' }) {
  const params = new URLSearchParams({ country });
  if (countryName) params.append('countryName', countryName);
  if (dateRange) params.append('dateRange', dateRange);
  if (tone) params.append('tone', tone);
  if (eventType) params.append('eventType', eventType);

  return apiFetch(`/events?${params}`);
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
 * Generate a Recharts-compatible bar chart for the session's news.
 * POST /api/country-session/:sessionId/graph
 */
export async function fetchGraph(sessionId) {
  return apiFetch(`/country-session/${sessionId}/graph`, { method: 'POST' });
}

/**
 * Generate a chronological timeline of events for the session's news.
 * POST /api/country-session/:sessionId/timeline
 */
export async function fetchTimeline(sessionId) {
  return apiFetch(`/country-session/${sessionId}/timeline`, { method: 'POST' });
}

/**
 * Health check.
 */
export async function checkHealth() {
  return apiFetch('/health');
}
