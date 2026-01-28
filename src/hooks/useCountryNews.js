import { useCallback, useEffect, useState } from 'react';
import { fetchCountryNews } from '../services/newsApi';
import { getCountryCode, isNewsApiSupported } from '../utils/countryCodes';

/**
 * Custom hook for fetching news articles for a selected country
 *
 * Data Flow:
 * 1. Country selection triggers the hook
 * 2. Country name is mapped to ISO code
 * 3. NewsAPI is called with the country code
 * 4. Articles are transformed and stored in state
 * 5. UI receives standardized article data
 *
 * @param {Object|null} selectedCountry - Country feature object from globe
 * @param {Object} options - Hook options
 * @param {number} options.pageSize - Number of articles to fetch
 * @param {boolean} options.autoFetch - Whether to fetch automatically on selection
 * @returns {Object} News state and controls
 */
export function useCountryNews(selectedCountry, options = {}) {
  const { pageSize = 15, autoFetch = true } = options;

  // State
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [countryInfo, setCountryInfo] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  /**
   * Fetches news for the given country
   * @param {string} countryName - Country name
   * @param {string} countryCode - ISO country code
   */
  const fetchNews = useCallback(async (countryName, countryCode) => {
    if (!countryCode) {
      setError(`News not available for ${countryName}. Country code not found.`);
      setArticles([]);
      return;
    }

    if (!isNewsApiSupported(countryCode)) {
      setError(`News headlines not available for ${countryName}. This country is not supported by the news API.`);
      setArticles([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchCountryNews(countryCode, countryName, { pageSize });

      if (result.error) {
        setError(result.error);
        setArticles([]);
      } else if (result.articles.length === 0) {
        setError(`No news articles found for ${countryName}.`);
        setArticles([]);
      } else {
        setArticles(result.articles);
        setError(null);
      }

      setLastFetched(new Date());
    } catch (err) {
      setError(`Failed to fetch news: ${err.message}`);
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    if (countryInfo?.code && countryInfo?.name) {
      fetchNews(countryInfo.name, countryInfo.code);
    }
  }, [countryInfo, fetchNews]);

  /**
   * Clear news state
   */
  const clearNews = useCallback(() => {
    setArticles([]);
    setError(null);
    setCountryInfo(null);
    setLastFetched(null);
  }, []);

  // Effect: Fetch news when country selection changes
  useEffect(() => {
    if (!selectedCountry) {
      clearNews();
      return;
    }

    const countryName = selectedCountry.properties?.name;
    if (!countryName) {
      setError('Invalid country selection');
      return;
    }

    const code = getCountryCode(countryName);
    const info = {
      name: countryName,
      code,
      supported: code ? isNewsApiSupported(code) : false,
    };
    setCountryInfo(info);

    if (autoFetch) {
      fetchNews(countryName, code);
    }
  }, [selectedCountry, autoFetch, fetchNews, clearNews]);

  return {
    // Data
    articles,
    countryInfo,
    lastFetched,

    // Status
    isLoading,
    error,
    hasArticles: articles.length > 0,

    // Actions
    refresh,
    clearNews,
  };
}

/**
 * Response format documentation for frontend integration:
 *
 * {
 *   articles: [
 *     {
 *       id: "bbc-news-0-1234567890",
 *       title: "Breaking News Headline",
 *       description: "Short summary of the article...",
 *       source: "BBC News",
 *       url: "https://bbc.com/news/article",
 *       publishedAt: "2024-01-15T10:30:00Z",
 *       imageUrl: "https://bbc.com/image.jpg"
 *     },
 *     ...
 *   ],
 *   countryInfo: {
 *     name: "United States",
 *     code: "us",
 *     supported: true
 *   },
 *   isLoading: false,
 *   error: null,
 *   hasArticles: true,
 *   lastFetched: Date,
 *   refresh: Function,
 *   clearNews: Function
 * }
 */
