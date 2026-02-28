import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCountrySession,
  getSessionStatus,
  fetchGraph,
  fetchTimeline,
} from '../services/backendApi';
import { getCountryCode } from '../utils/countryCodes';

/**
 * useCountrySession — Manages country analysis state only.
 */
export function useCountrySession(selectedCountry) {
  const [sessionId, setSessionId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('idle');
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);
  const [isGeneratingTimeline, setIsGeneratingTimeline] = useState(false);

  const pollRef = useRef(null);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setSessionId(null);
    setSessionStatus('idle');
    setBrief(null);
    setError(null);
    setGraphData(null);
    setTimelineData(null);
  }, []);

  useEffect(() => {
    if (!selectedCountry) {
      abortRef.current = true;
      reset();
      return;
    }

    const countryName = selectedCountry.properties?.name;
    if (!countryName) return;

    const countryCode = getCountryCode(countryName);
    if (!countryCode) return;

    abortRef.current = false;
    reset();

    async function initSession() {
      try {
        setSessionStatus('building');
        setError(null);

        const result = await createCountrySession(countryCode, countryName);
        if (abortRef.current) return;

        setSessionId(result.sessionId);

        if (result.status === 'ready') {
          const status = await getSessionStatus(result.sessionId);
          if (abortRef.current) return;
          setSessionStatus('ready');
          setBrief(status.brief || null);
          return;
        }

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
            console.warn('[useCountrySession] Poll error:', err.message);
          }
        }, 2000);
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

  const generateGraph = useCallback(async () => {
    if (!sessionId || sessionStatus !== 'ready') return;
    setIsGeneratingGraph(true);
    try {
      const result = await fetchGraph(sessionId);
      setGraphData(result.graphData || null);
    } catch (err) {
      console.error('[useCountrySession] Graph error:', err.message);
    } finally {
      setIsGeneratingGraph(false);
    }
  }, [sessionId, sessionStatus]);

  const generateTimeline = useCallback(async () => {
    if (!sessionId || sessionStatus !== 'ready') return;
    setIsGeneratingTimeline(true);
    try {
      const result = await fetchTimeline(sessionId);
      setTimelineData(result.timelineData || null);
    } catch (err) {
      console.error('[useCountrySession] Timeline error:', err.message);
    } finally {
      setIsGeneratingTimeline(false);
    }
  }, [sessionId, sessionStatus]);

  return {
    sessionId,
    sessionStatus,
    brief,
    error,
    graphData,
    timelineData,
    isGeneratingGraph,
    isGeneratingTimeline,
    generateGraph,
    generateTimeline,
    reset,
  };
}
