/**
 * News Service — Server-side NewsAPI proxy
 *
 * Mirrors the frontend newsApi.js logic but runs server-side so the
 * API key is never exposed to the browser.
 *
 * Endpoints used:
 *   GET /v2/top-headlines  — Breaking news by country
 *   GET /v2/everything     — Broader fallback search
 */
import { config } from '../config/index.js';

const BASE_URL = config.newsApiBaseUrl;
const API_KEY = config.newsApiKey;

/**
 * Standardize a raw NewsAPI article into our internal format.
 */
function transformArticle(raw, index) {
  return {
    id: `${raw.source?.id || 'unknown'}-${index}-${Date.now()}`,
    title: raw.title || 'No title available',
    description:
      raw.description || raw.content?.substring(0, 200) || 'No description available',
    source: raw.source?.name || 'Unknown Source',
    url: raw.url || '#',
    publishedAt: raw.publishedAt || new Date().toISOString(),
    imageUrl: raw.urlToImage || null,
    // Keep raw content for RAG chunking
    content: raw.content || raw.description || '',
  };
}

/**
 * Fetch top headlines for a country code.
 *
 * @param {string} countryCode - ISO 3166-1 alpha-2 (e.g. "ca")
 * @param {object} opts
 * @param {number} [opts.pageSize=20]
 * @param {string} [opts.category]
 * @param {string} [opts.q] - keyword filter
 * @returns {Promise<{articles: object[], totalResults: number, error: string|null}>}
 */
export async function fetchTopHeadlines(countryCode, opts = {}) {
  const { pageSize = 20, category, q } = opts;

  if (!countryCode || countryCode.length !== 2) {
    return { articles: [], totalResults: 0, error: 'Invalid country code.' };
  }

  const params = new URLSearchParams({
    country: countryCode.toLowerCase(),
    pageSize: String(pageSize),
    apiKey: API_KEY,
  });
  if (category) params.append('category', category);
  if (q) params.append('q', q);

  try {
    const res = await fetch(`${BASE_URL}/top-headlines?${params}`);
    const data = await res.json();

    if (data.status === 'error') {
      return { articles: [], totalResults: 0, error: data.message || 'NewsAPI error' };
    }

    const articles = (data.articles || [])
      .filter((a) => a.title && a.title !== '[Removed]')
      .map(transformArticle);

    return { articles, totalResults: data.totalResults || 0, error: null };
  } catch (err) {
    return { articles: [], totalResults: 0, error: `Network error: ${err.message}` };
  }
}

/**
 * Fallback: fetch articles via the /everything endpoint.
 */
export async function fetchEverythingByCountry(countryName, opts = {}) {
  const { pageSize = 20, language = 'en', hours = 72 } = opts;

  if (!countryName) {
    return { articles: [], totalResults: 0, error: 'Country name required.' };
  }

  const from = new Date(Date.now() - hours * 3600_000).toISOString().slice(0, 10);

  const params = new URLSearchParams({
    q: countryName,
    from,
    sortBy: 'publishedAt',
    language,
    pageSize: String(pageSize),
    apiKey: API_KEY,
  });

  try {
    const res = await fetch(`${BASE_URL}/everything?${params}`);
    const data = await res.json();

    if (data.status === 'error') {
      return { articles: [], totalResults: 0, error: data.message || 'NewsAPI error' };
    }

    const articles = (data.articles || [])
      .filter((a) => a.title && a.title !== '[Removed]')
      .map(transformArticle);

    return { articles, totalResults: data.totalResults || 0, error: null };
  } catch (err) {
    return { articles: [], totalResults: 0, error: `Network error: ${err.message}` };
  }
}

/**
 * Main entry: fetch country news with fallback logic.
 *
 * 1. Try top-headlines
 * 2. If < minResults, supplement with /everything
 * 3. Deduplicate by title
 */
export async function fetchCountryNews(countryCode, countryName, opts = {}) {
  const { pageSize = 20, minResults = 5, category, q, hours = 72 } = opts;

  const headlines = await fetchTopHeadlines(countryCode, { pageSize, category, q });

  if (headlines.error || headlines.articles.length >= minResults) {
    return { ...headlines, source: 'top-headlines' };
  }

  const everything = await fetchEverythingByCountry(countryName, {
    pageSize: pageSize - headlines.articles.length,
    hours,
  });

  if (everything.error) {
    return { ...headlines, source: 'top-headlines' };
  }

  // Deduplicate by normalized title
  const seen = new Set(headlines.articles.map((a) => a.title.toLowerCase()));
  const unique = everything.articles.filter((a) => !seen.has(a.title.toLowerCase()));

  return {
    articles: [...headlines.articles, ...unique].slice(0, pageSize),
    totalResults: headlines.totalResults + everything.totalResults,
    error: null,
    source: 'combined',
  };
}
