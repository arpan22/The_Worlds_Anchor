import { useCallback, useEffect, useState } from 'react';
import { fetchEvents } from '../services/backendApi';
import { getCountryCode } from '../utils/countryCodes';

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

  const fetchForCountry = useCallback(async (countryName, countryCode) => {
    if (!countryCode) {
      setError(`No country code found for ${countryName}.`);
      setArticles([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchEvents({
        country: countryCode,
        countryName,
        dateRange,
        tone,
        eventType,
      });

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
