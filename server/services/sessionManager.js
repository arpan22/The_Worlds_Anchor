/**
 * Session Manager — In-memory country session store with TTL
 *
 * Each CountrySession tracks:
 *   - sessionId         — UUID
 *   - countryCode       — ISO-2 (e.g. "ca")
 *   - countryName       — Human readable
 *   - createdAt         — Timestamp
 *   - status            — "building" | "ready" | "error"
 *   - articles          — Raw article list
 *   - brief             — Nemotron-generated country brief
 *   - vectorIndex       — In-memory vector index reference
 *   - chatHistory       — Array of {role, content}
 *   - error             — Error message if status === "error"
 *
 * Sessions expire after configurable TTL (default 10 min).
 */
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';

const sessions = new Map();

// Cleanup expired sessions every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > config.sessionTtlMs) {
      sessions.delete(id);
      console.log(`[SessionManager] Expired session ${id}`);
    }
  }
}, 60_000);

/**
 * Create a new country session.
 * @param {string} countryCode
 * @param {string} countryName
 * @returns {object} The new session object
 */
export function createSession(countryCode, countryName) {
  const sessionId = randomUUID();
  const session = {
    sessionId,
    countryCode,
    countryName,
    createdAt: Date.now(),
    status: 'building',
    articles: [],
    brief: null,
    vectorIndex: null,
    chatHistory: [],
    error: null,
  };

  sessions.set(sessionId, session);
  console.log(`[SessionManager] Created session ${sessionId} for ${countryName} (${countryCode})`);
  return session;
}

/**
 * Get a session by ID.
 * @param {string} sessionId
 * @returns {object|null}
 */
export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * Update fields on an existing session.
 * @param {string} sessionId
 * @param {object} updates - Partial session object
 */
export function updateSession(sessionId, updates) {
  const session = sessions.get(sessionId);
  if (!session) return;
  Object.assign(session, updates);
}

/**
 * Find an existing fresh session for a country (avoids re-embedding).
 * Returns the session if it was created within the TTL window and is ready or building.
 *
 * @param {string} countryCode
 * @returns {object|null}
 */
export function findFreshSession(countryCode) {
  const now = Date.now();
  for (const session of sessions.values()) {
    if (
      session.countryCode === countryCode &&
      now - session.createdAt < config.sessionTtlMs &&
      (session.status === 'ready' || session.status === 'building')
    ) {
      console.log(`[SessionManager] Reusing fresh session ${session.sessionId} for ${countryCode}`);
      return session;
    }
  }
  return null;
}

/**
 * Add a chat turn to the session history.
 * @param {string} sessionId
 * @param {string} role  - "user" or "assistant"
 * @param {string} content
 */
export function addChatMessage(sessionId, role, content) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.chatHistory.push({ role, content });
}
