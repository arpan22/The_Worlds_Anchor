import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEvents } from '../services/backendApi';
import { getCountryCode } from '../utils/countryCodes';

const RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_BACKOFF_MS = 7000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('temporarily rate-limited')
    || text.includes('rate limit')
    || text.includes('http 429')
  );
}

/**
 * useCountryEvents — Fetches GDELT events for the selected country.
 *
 * Replaces useCountryNews. GDELT covers 200+ countries with no API key.
 *
 * @param {object|null} selectedCountry - Country feature object from globe
 * @param {object} filters - { dateRange, tone, eventType }
 * @param {object} [options]
 * @returns {object} { articles, toneSeries, isLoading, error, countryInfo, refresh }
 */
export function useCountryEvents(selectedCountry, filters = {}, options = {}) {
  const { dateRange = '7d', tone = 'all', eventType = 'all' } = filters;

  const [articles, setArticles] = useState([]);
  const [toneSeries, setToneSeries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [countryInfo, setCountryInfo] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const inFlightKeyRef = useRef(null);
  const lastRequestRef = useRef({ key: null, at: 0 });

  const fetchForCountry = useCallback(async (countryName, countryCode) => {
    if (!countryCode) {
      setError(`No country code found for ${countryName}.`);
      setArticles([]);
      return;
    }

    const requestKey = `${countryCode}:${countryName}:${dateRange}:${tone}:${eventType}`;
    const now = Date.now();
    const recentDuplicate = (
      lastRequestRef.current.key === requestKey
      && (now - lastRequestRef.current.at) < 6000
    );

    if (inFlightKeyRef.current === requestKey || recentDuplicate) {
      return;
    }

    inFlightKeyRef.current = requestKey;
    lastRequestRef.current = { key: requestKey, at: now };

    setIsLoading(true);
    setError(null);

    try {
      let result = null;
      let attempt = 0;
      while (attempt <= RATE_LIMIT_RETRIES) {
        try {
          result = await fetchEvents({
            country: countryCode,
            countryName,
            dateRange,
            tone,
            eventType,
          });
          break;
        } catch (err) {
          const canRetry = isRateLimitError(err?.message) && attempt < RATE_LIMIT_RETRIES;
          if (!canRetry) throw err;
          attempt += 1;
          await sleep(RATE_LIMIT_BACKOFF_MS * attempt);
        }
      }

      if (result.articles && result.articles.length > 0) {
        setArticles(result.articles);
        setToneSeries(result.toneSeries || []);
        setError(null);
      } else {
        setArticles([]);
        setToneSeries([]);
        setError(`No events found for ${countryName} in the selected time range.`);
      }

      setLastFetched(new Date());
    } catch (err) {
      setError(`Failed to fetch events: ${err.message}`);
      setArticles([]);
      setToneSeries([]);
    } finally {
      if (inFlightKeyRef.current === requestKey) {
        inFlightKeyRef.current = null;
      }
      setIsLoading(false);
    }
  }, [dateRange, tone, eventType]);

  const refresh = useCallback(() => {
    if (countryInfo?.code && countryInfo?.name) {
      fetchForCountry(countryInfo.name, countryInfo.code);
    }
  }, [countryInfo, fetchForCountry]);

  const clearEvents = useCallback(() => {
    setArticles([]);
    setToneSeries([]);
    setError(null);
    setCountryInfo(null);
    setLastFetched(null);
  }, []);

  // Fetch when country or filters change
  useEffect(() => {
    if (!selectedCountry) {
      clearEvents();
      return;
    }

    const countryName = selectedCountry.properties?.name;
    if (!countryName) {
      setError('Invalid country selection');
      return;
    }

    const code = getCountryCode(countryName);
    const info = { name: countryName, code, supported: Boolean(code) };
    setCountryInfo(info);

    // Sports tab uses local country profile data in the frontend.
    if (eventType === 'Sports') {
      setArticles([]);
      setToneSeries([]);
      setError(null);
      setIsLoading(false);
      setLastFetched(new Date());
      return;
    }

    fetchForCountry(countryName, code);
  }, [selectedCountry, fetchForCountry, clearEvents]);

  return {
    articles,
    toneSeries,
    countryInfo,
    lastFetched,
    isLoading,
    error,
    hasArticles: articles.length > 0,
    refresh,
    clearEvents,
  };
}
