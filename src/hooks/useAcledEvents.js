/**
 * useAcledEvents
 *
 * Custom React hook for fetching ACLED conflict/protest events.
 * Debounces filter changes (400ms) to avoid hammering the server.
 * Returns normalized events, aggregate stats, loading/error state.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAcledEvents } from '../services/acledApi.js';

/**
 * @param {object} filters
 * @param {string} filters.country     Full country name for ACLED
 * @param {string} filters.start_date  "YYYY-MM-DD"
 * @param {string} filters.end_date    "YYYY-MM-DD"
 * @param {string} [filters.event_type]
 * @param {string} [filters.actor]
 * @param {string} [filters.admin1]
 * @param {number} [filters.fatalities_min]
 */
export function useAcledEvents(filters) {
  const [events, setEvents] = useState([]);
  const [aggregates, setAggregates] = useState({
    timeline: [],
    typeBreakdown: [],
    topActors: [],
  });
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attribution, setAttribution] = useState('');
  const [dataNote, setDataNote] = useState(null);  // informational note (e.g. "no results for country")
  const [source, setSource] = useState(null);       // 'local-xlsx' | 'live-api'

  // Track active fetch so we can ignore stale responses
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  const load = useCallback((f) => {
    if (!f.start_date || !f.end_date) return;

    // Cancel any pending debounce
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchAcledEvents(f);
        if (controller.signal.aborted) return;

        setEvents(data.events || []);
        setAggregates(
          data.aggregates || { timeline: [], typeBreakdown: [], topActors: [] }
        );
        setTotal(data.total || 0);
        setAttribution(data.attribution || '');
        setDataNote(data.dataNote || null);
        setSource(data.source || null);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('[useAcledEvents]', err.message);
        setError(err.message);
        setEvents([]);
        setAggregates({ timeline: [], typeBreakdown: [], topActors: [] });
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 400);
  }, []);

  useEffect(() => {
    load(filters);
    return () => {
      clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [
    filters.country,
    filters.start_date,
    filters.end_date,
    filters.event_type,
    filters.actor,
    filters.admin1,
    filters.fatalities_min,
    load,
  ]);

  const refresh = useCallback(() => load(filters), [filters, load]);

  return { events, aggregates, total, isLoading, error, attribution, dataNote, source, refresh };
}
