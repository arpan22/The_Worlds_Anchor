/**
 * NewsAPI and WorldNewsAPI Service
 *
 * Primary data sources:
 * 1. NewsAPI (https://newsapi.org) - High quality, curated news for ~50 countries
 * 2. WorldNewsAPI (https://worldnewsapi.com) - Broad coverage for 200+ countries
 *
 * Endpoints used:
 * NewsAPI:
 * 1. /v2/top-headlines - Fetches breaking news headlines for a country
 *    - Used because it provides curated, current news filtered by country
 *    - Supports country parameter with ISO 3166-1 alpha-2 codes
 *
 * 2. /v2/everything (fallback) - Broader search if top-headlines returns few results
 *    - Used as backup for countries with limited top-headlines coverage
 *
 * WorldNewsAPI:
 * 1. /top-news - Fetches top news from a country
 *    - Used for countries not supported by NewsAPI
 *    - Returns clustered news from multiple sources
 *
 * Rate Limits:
 * NewsAPI (Free tier): 100 requests per day
 * WorldNewsAPI: Varies by plan, 1 point per top-news request
 */

const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY || 'YOUR_API_KEY_HERE';
const BASE_URL = 'https://newsapi.org/v2';

const WORLD_NEWS_API_KEY = import.meta.env.VITE_WORLD_NEWS_API_KEY || 'YOUR_WORLD_NEWS_API_KEY_HERE';
const WORLD_NEWS_BASE_URL = 'https://api.worldnewsapi.com';

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
 * Transforms raw WorldNewsAPI article to our standardized format
 * @param {Object} rawArticle - Article from WorldNewsAPI response
 * @param {number} index - Index for ID generation
 * @returns {Article}
 */
function transformWorldNewsArticle(rawArticle, index) {
  return {
    id: `worldnews-${rawArticle.id || index}-${Date.now()}`,
    title: rawArticle.title || 'No title available',
    description: rawArticle.summary || rawArticle.text?.substring(0, 200) || 'No description available',
    source: rawArticle.author || 'World News',
    url: rawArticle.url || '#',
    publishedAt: rawArticle.publish_date || new Date().toISOString(),
    imageUrl: rawArticle.image || null,
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
 * Fetches top news from WorldNewsAPI for a specific country
 *
 * API Endpoint: GET /top-news
 * Parameters:
 *   - source-country: ISO 3166-1 alpha-2 country code
 *   - language: Language code (default: 'en')
 *   - date: Date for news (default: today)
 *   - headlines-only: Boolean for basic info only
 *
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @param {Object} options - Additional options
 * @param {number} options.pageSize - Number of articles to fetch (default: 20)
 * @param {string} options.language - Language code (default: 'en')
 * @returns {Promise<{articles: Article[], totalResults: number, error: string|null}>}
 */
export async function fetchWorldNewsTopNews(countryCode, options = {}) {
  const { pageSize = 20, language = 'en' } = options;

  if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) {
    return {
      articles: [],
      totalResults: 0,
      error: 'Invalid country code. Must be a 2-letter ISO code.',
    };
  }

  const params = new URLSearchParams({
    'source-country': countryCode.toLowerCase(),
    language,
    'headlines-only': 'false',
  });

  try {
    const response = await fetch(`${WORLD_NEWS_BASE_URL}/top-news?${params}`, {
      headers: {
        'x-api-key': WORLD_NEWS_API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return handleWorldNewsApiError(data);
    }

    // WorldNewsAPI returns clustered news - flatten them
    const allArticles = [];
    if (data.top_news && Array.isArray(data.top_news)) {
      for (const cluster of data.top_news) {
        if (cluster.news && Array.isArray(cluster.news)) {
          allArticles.push(...cluster.news);
        }
      }
    }

    // Transform and limit results
    const articles = allArticles
      .filter(article => article.title)
      .slice(0, pageSize)
      .map(transformWorldNewsArticle);

    return {
      articles,
      totalResults: articles.length,
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
 * Handles WorldNewsAPI error responses
 * @param {Object} errorData - Error response from WorldNewsAPI
 * @returns {{articles: [], totalResults: 0, error: string}}
 */
function handleWorldNewsApiError(errorData) {
  const errorMessage = errorData?.message || 'WorldNewsAPI error occurred';
  return {
    articles: [],
    totalResults: 0,
    error: errorMessage,
  };
}

/**
 * Main function: Fetches news for a country with fallback logic
 *
 * Strategy:
 * 1. Try NewsAPI top-headlines first (best quality for supported countries)
 * 2. If not enough results or not supported, try WorldNewsAPI
 * 3. As last resort, use NewsAPI everything endpoint
 *
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @param {string} countryName - Full country name (for fallback search)
 * @param {Object} options - Fetch options
 * @returns {Promise<{articles: Article[], totalResults: number, error: string|null, source: string}>}
 */
export async function fetchCountryNews(countryCode, countryName, options = {}) {
  const { pageSize = 20, minResults = 5 } = options;

  // Primary: Try NewsAPI top-headlines first (best quality for supported countries)
  const headlinesResult = await fetchTopHeadlines(countryCode, { pageSize });

  // If we have enough results and no error, return NewsAPI results
  if (!headlinesResult.error && headlinesResult.articles.length >= minResults) {
    return {
      ...headlinesResult,
      source: 'newsapi-top-headlines',
    };
  }

  // Secondary: Try WorldNewsAPI for broader coverage
  const worldNewsResult = await fetchWorldNewsTopNews(countryCode, { pageSize });

  if (!worldNewsResult.error && worldNewsResult.articles.length > 0) {
    return {
      ...worldNewsResult,
      source: 'worldnewsapi',
    };
  }

  // Tertiary: Fallback to NewsAPI everything endpoint as last resort
  const everythingResult = await fetchEverythingByCountry(countryName, { pageSize });

  if (everythingResult.error) {
    // Return whatever we have from the first attempt
    return {
      ...headlinesResult,
      source: 'newsapi-top-headlines',
    };
  }

  return {
    ...everythingResult,
    source: 'newsapi-everything',
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
