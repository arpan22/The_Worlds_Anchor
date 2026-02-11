import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCountrySession,
  getSessionStatus,
  sendChatMessage,
} from '../services/backendApi';
import { getCountryCode } from '../utils/countryCodes';

/**
 * useCountrySession — Manages the Nemotron-powered session lifecycle.
 *
 * On country selection:
 *   1. Creates a server-side session (triggers Nemotron brief + RAG)
 *   2. Polls for brief readiness
 *   3. Provides chat send/receive interface
 *
 * @param {object|null} selectedCountry - Country feature object from globe
 * @param {object} [settings] - User settings (geminiEnabled, token limits, etc.)
 * @returns {object} Session state + chat controls
 */
export function useCountrySession(selectedCountry, settings = {}) {
  const [sessionId, setSessionId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('idle'); // idle | building | ready | error
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(null);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);

  // Refs for cleanup
  const pollRef = useRef(null);
  const abortRef = useRef(false);

  // ── Reset on country change ──
  const reset = useCallback(() => {
    abortRef.current = true;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setSessionId(null);
    setSessionStatus('idle');
    setBrief(null);
    setError(null);
    setMessages([]);
    setIsSending(false);
  }, []);

  // ── Create session when country is selected ──
  useEffect(() => {
    if (!selectedCountry) {
      reset();
      return;
    }

    const countryName = selectedCountry.properties?.name;
    if (!countryName) return;

    const countryCode = getCountryCode(countryName);
    if (!countryCode) return;

    abortRef.current = false;

    async function initSession() {
      try {
        setSessionStatus('building');
        setError(null);

        const result = await createCountrySession(countryCode, countryName);

        if (abortRef.current) return;

        setSessionId(result.sessionId);

        // If session was cached and already ready, use it directly
        if (result.status === 'ready') {
          const status = await getSessionStatus(result.sessionId);
          if (abortRef.current) return;
          setSessionStatus('ready');
          setBrief(status.brief || null);
          return;
        }

        // Start polling for readiness
        pollRef.current = setInterval(async () => {
          try {
            const status = await getSessionStatus(result.sessionId);

            if (abortRef.current) {
              clearInterval(pollRef.current);
              return;
            }

            if (status.status === 'ready') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setSessionStatus('ready');
              setBrief(status.brief || null);
            } else if (status.status === 'error') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setSessionStatus('error');
              setError(status.error || 'Brief generation failed.');
            }
          } catch (err) {
            // Polling error — keep trying
            console.warn('[useCountrySession] Poll error:', err.message);
          }
        }, 2000); // Poll every 2 seconds
      } catch (err) {
        if (!abortRef.current) {
          setSessionStatus('error');
          setError(err.message);
        }
      }
    }

    initSession();

    return () => {
      abortRef.current = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [selectedCountry, reset]);

  // ── Send chat message ──
  const sendMessage = useCallback(
    async (text) => {
      if (!sessionId || sessionStatus !== 'ready' || !text.trim()) return;

      const userMsg = { role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);

      try {
        const result = await sendChatMessage(sessionId, text.trim(), settings);

        const assistantMsg = {
          role: 'assistant',
          content: result.reply,
          sources: result.sources || { news: [], web: [] },
          sourceType: result.sourceType || 'news_only',
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errMsg = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err.message}`,
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsSending(false);
      }
    },
    [sessionId, sessionStatus, settings]
  );

  return {
    sessionId,
    sessionStatus,
    brief,
    error,

    // Chat
    messages,
    isSending,
    sendMessage,

    // Controls
    reset,
  };
}
