/**
 * NewsAPI Service
 *
 * Primary data source: NewsAPI (https://newsapi.org)
 *
 * Endpoints used:
 * 1. /v2/top-headlines - Fetches breaking news headlines for a country
 *    - Used because it provides curated, current news filtered by country
 *    - Supports country parameter with ISO 3166-1 alpha-2 codes
 *
 * 2. /v2/everything (fallback) - Broader search if top-headlines returns few results
 *    - Used as backup for countries with limited top-headlines coverage
 *
 * Rate Limits (Free tier):
 * - 100 requests per day
 * - Results limited to 100 articles per request
 */

const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY || 'YOUR_API_KEY_HERE';
const BASE_URL = 'https://newsapi.org/v2';

/**
 * Standardized article format for frontend consumption
 * @typedef {Object} Article
 * @property {string} id - Unique identifier
 * @property {string} title - Article headline
 * @property {string} description - Short summary/description
 * @property {string} source - News outlet name (e.g., "BBC News", "CNN")
 * @property {string} url - Link to full article
 * @property {string} publishedAt - ISO 8601 timestamp
 * @property {string} imageUrl - Thumbnail image URL (optional)
 */

/**
 * Transforms raw NewsAPI article to our standardized format
 * @param {Object} rawArticle - Article from NewsAPI response
 * @param {number} index - Index for ID generation
 * @returns {Article}
 */
function transformArticle(rawArticle, index) {
  return {
    id: `${rawArticle.source?.id || 'unknown'}-${index}-${Date.now()}`,
    title: rawArticle.title || 'No title available',
    description: rawArticle.description || rawArticle.content?.substring(0, 150) || 'No description available',
    source: rawArticle.source?.name || 'Unknown Source',
    url: rawArticle.url || '#',
    publishedAt: rawArticle.publishedAt || new Date().toISOString(),
    imageUrl: rawArticle.urlToImage || null,
  };
}

/**
 * Fetches top headlines for a specific country
 *
 * API Endpoint: GET /v2/top-headlines
 * Parameters:
 *   - country: ISO 3166-1 alpha-2 country code (e.g., 'us', 'gb', 'in')
 *   - pageSize: Number of results (max 100)
 *   - category: Optional news category filter
 *
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @param {Object} options - Additional options
 * @param {number} options.pageSize - Number of articles to fetch (default: 20)
 * @param {string} options.category - News category (optional)
 * @returns {Promise<{articles: Article[], totalResults: number, error: string|null}>}
 */
export async function fetchTopHeadlines(countryCode, options = {}) {
  const { pageSize = 20, category = null } = options;

  // Validate country code
  if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) {
    return {
      articles: [],
      totalResults: 0,
      error: 'Invalid country code. Must be a 2-letter ISO code.',
    };
  }

  const params = new URLSearchParams({
    country: countryCode.toLowerCase(),
    pageSize: String(pageSize),
    apiKey: NEWS_API_KEY,
  });

  if (category) {
    params.append('category', category);
  }

  try {
    const response = await fetch(`${BASE_URL}/top-headlines?${params}`);
    const data = await response.json();

    // Handle API errors
    if (data.status === 'error') {
      return handleApiError(data);
    }

    // Transform articles to standardized format
    const articles = (data.articles || [])
      .filter(article => article.title && article.title !== '[Removed]')
      .map(transformArticle);

    return {
      articles,
      totalResults: data.totalResults || 0,
      error: null,
    };
  } catch (error) {
    return {
      articles: [],
      totalResults: 0,
      error: `Network error: ${error.message}`,
    };
  }
}

/**
 * Fallback: Fetches news using the everything endpoint
 * Used when top-headlines returns insufficient results
 *
 * API Endpoint: GET /v2/everything
 * Parameters:
 *   - q: Search query (uses country name)
 *   - sortBy: Sort order (publishedAt for latest news)
 *   - language: Filter by language
 *
 * @param {string} countryName - Full country name for search
 * @param {Object} options - Additional options
 * @returns {Promise<{articles: Article[], totalResults: number, error: string|null}>}
 */
export async function fetchEverythingByCountry(countryName, options = {}) {
  const { pageSize = 20, language = 'en' } = options;

  if (!countryName) {
    return {
      articles: [],
      totalResults: 0,
      error: 'Country name is required',
    };
  }

  const params = new URLSearchParams({
    q: countryName,
    sortBy: 'publishedAt',
    language,
    pageSize: String(pageSize),
    apiKey: NEWS_API_KEY,
  });

  try {
    const response = await fetch(`${BASE_URL}/everything?${params}`);
    const data = await response.json();

    if (data.status === 'error') {
      return handleApiError(data);
    }

    const articles = (data.articles || [])
      .filter(article => article.title && article.title !== '[Removed]')
      .map(transformArticle);

    return {
      articles,
      totalResults: data.totalResults || 0,
      error: null,
    };
  } catch (error) {
    return {
      articles: [],
      totalResults: 0,
      error: `Network error: ${error.message}`,
    };
  }
}

/**
 * Main function: Fetches news for a country with fallback logic
 *
 * Strategy:
 * 1. Try top-headlines endpoint first (best for current news)
 * 2. If results < 5, supplement with everything endpoint
 * 3. Deduplicate and return combined results
 *
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @param {string} countryName - Full country name (for fallback search)
 * @param {Object} options - Fetch options
 * @returns {Promise<{articles: Article[], totalResults: number, error: string|null, source: string}>}
 */
export async function fetchCountryNews(countryCode, countryName, options = {}) {
  const { pageSize = 20, minResults = 5 } = options;

  // Primary: Fetch top headlines
  const headlinesResult = await fetchTopHeadlines(countryCode, { pageSize });

  // If we have enough results or there was an error, return as-is
  if (headlinesResult.error || headlinesResult.articles.length >= minResults) {
    return {
      ...headlinesResult,
      source: 'top-headlines',
    };
  }

  // Fallback: Supplement with everything endpoint if needed
  const everythingResult = await fetchEverythingByCountry(countryName, {
    pageSize: pageSize - headlinesResult.articles.length,
  });

  if (everythingResult.error) {
    // Return headlines even if fallback failed
    return {
      ...headlinesResult,
      source: 'top-headlines',
    };
  }

  // Combine and deduplicate by title
  const seenTitles = new Set(headlinesResult.articles.map(a => a.title.toLowerCase()));
  const uniqueEverythingArticles = everythingResult.articles.filter(
    article => !seenTitles.has(article.title.toLowerCase())
  );

  return {
    articles: [...headlinesResult.articles, ...uniqueEverythingArticles].slice(0, pageSize),
    totalResults: headlinesResult.totalResults + everythingResult.totalResults,
    error: null,
    source: 'combined',
  };
}

/**
 * Handles NewsAPI error responses
 * @param {Object} errorData - Error response from NewsAPI
 * @returns {{articles: [], totalResults: 0, error: string}}
 */
function handleApiError(errorData) {
  const errorMessages = {
    apiKeyInvalid: 'Invalid API key. Please check your NewsAPI key.',
    apiKeyExhausted: 'API rate limit exceeded. Please try again later.',
    apiKeyMissing: 'API key is missing. Please configure your NewsAPI key.',
    parametersMissing: 'Required parameters are missing.',
    rateLimited: 'Too many requests. Please wait before trying again.',
    sourcesTooMany: 'Too many sources requested.',
    sourceDoesNotExist: 'The requested news source does not exist.',
    unexpectedError: 'An unexpected error occurred.',
  };

  const errorMessage = errorMessages[errorData.code] || errorData.message || 'Unknown error occurred';

  return {
    articles: [],
    totalResults: 0,
    error: errorMessage,
  };
}

/**
 * Formats the published date for display
 * @param {string} isoDate - ISO 8601 date string
 * @returns {string} Formatted date string
 */
export function formatPublishedDate(isoDate) {
  if (!isoDate) return 'Unknown date';

  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
