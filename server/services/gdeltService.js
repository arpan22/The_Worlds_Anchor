/**
 * GDELT Service — Country news via the GDELT Doc 2.0 API
 *
 * No API key required. GDELT is a free, public dataset.
 *
 * Endpoint used:
 *   mode=artlist — Article list with URL, title, domain, date
 *
 * Rate limit: Be polite — max ~5 req/sec. Cache results for 8 minutes.
 */
import { config } from '../config/index.js';
import https from 'https';

const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes
const FETCH_TIMEOUT_MS = 10_000;     // 10 s per request
const MIN_GDELT_INTERVAL_MS = 6_500; // Extra headroom to reduce 429 rate-limit hits
const GDELT_RATE_LIMIT_BACKOFF_MS = 8_000;
const CACHE_SCHEMA_VERSION = 'v4-country-topic-balanced';

// In-memory cache: key → { articles, toneSeries, expiresAt }
const _cache = new Map();
// Last successful country payloads (used when live fetch is rate-limited).
const _lastSuccessByCountry = new Map();
// In-flight request dedupe: key -> Promise<{ articles, toneSeries, error }>
const _inflight = new Map();
let _lastGdeltRequestAt = 0;
let _gdeltQueue = Promise.resolve();

// ── Country centroids (ISO-2 → [lat, lng]) ────────────────
const COUNTRY_CENTROIDS = {
  AF: [33.9, 67.7], AL: [41.2, 20.2], DZ: [28.0, 1.7], AO: [-11.2, 17.9],
  AR: [-38.4, -63.6], AM: [40.1, 45.0], AU: [-25.3, 133.8], AT: [47.5, 14.6],
  AZ: [40.1, 47.6], BD: [23.7, 90.4], BY: [53.7, 28.0], BE: [50.5, 4.5],
  BJ: [9.3, 2.3], BO: [-16.3, -63.6], BA: [44.2, 17.9], BW: [-22.3, 24.7],
  BR: [-14.2, -51.9], BN: [4.5, 114.7], BG: [42.7, 25.5], BF: [12.4, -1.6],
  MM: [21.9, 95.9], BI: [-3.4, 29.9], KH: [12.6, 104.9], CM: [3.9, 11.5],
  CA: [56.1, -106.3], CF: [7.0, 20.9], TD: [15.5, 18.7], CL: [-35.7, -71.5],
  CN: [35.9, 104.2], CO: [4.1, -72.9], CG: [-0.2, 15.8], CR: [9.7, -83.8],
  HR: [45.1, 15.2], CU: [22.0, -79.5], CY: [35.1, 33.4], CZ: [49.8, 15.5],
  DK: [56.3, 9.5], DO: [18.7, -70.2], EC: [-1.8, -78.2], EG: [26.8, 30.8],
  SV: [13.8, -88.9], ET: [9.1, 40.5], FI: [61.9, 25.7], FR: [46.2, 2.2],
  GA: [-0.8, 11.6], GE: [42.3, 43.4], DE: [51.2, 10.5], GH: [7.9, -1.0],
  GR: [39.1, 21.8], GT: [15.8, -90.2], GN: [11.0, -10.9], HT: [18.9, -72.3],
  HN: [15.2, -86.2], HK: [22.3, 114.2], HU: [47.2, 19.5], IN: [20.6, 78.9],
  ID: [-0.8, 113.9], IR: [32.4, 53.7], IQ: [33.2, 43.7], IE: [53.4, -8.2],
  IL: [31.0, 34.9], IT: [41.9, 12.6], JM: [18.1, -77.3], JP: [36.2, 138.3],
  JO: [30.6, 36.2], KZ: [48.0, 66.9], KE: [-0.0, 37.9], KP: [40.3, 127.5],
  KR: [35.9, 127.8], KW: [29.3, 47.5], KG: [41.2, 74.8], LA: [19.9, 102.5],
  LV: [56.9, 24.6], LB: [33.9, 35.9], LR: [6.4, -9.4], LY: [26.3, 17.2],
  LT: [55.2, 23.9], LU: [49.8, 6.1], MK: [41.6, 21.7], MG: [-18.8, 46.9],
  MW: [-13.3, 34.3], MY: [4.2, 108.0], ML: [17.6, -2.0], MR: [21.0, -10.9],
  MX: [23.6, -102.6], MD: [47.4, 28.4], MA: [31.8, -7.1], MZ: [-18.7, 35.5],
  NA: [-22.1, 17.1], NP: [28.4, 84.1], NL: [52.1, 5.3], NZ: [-40.9, 174.9],
  NI: [12.9, -85.2], NE: [17.6, 8.1], NG: [9.1, 8.7], NO: [60.5, 8.5],
  OM: [21.5, 55.9], PK: [30.4, 69.3], PA: [8.5, -80.8], PG: [-6.3, 143.9],
  PY: [-23.4, -58.4], PE: [-9.2, -75.0], PH: [12.9, 121.8], PL: [51.9, 19.1],
  PT: [39.4, -8.2], QA: [25.4, 51.2], RO: [45.9, 24.9], RU: [61.5, 105.3],
  RW: [-1.9, 29.9], SA: [23.9, 45.1], SN: [14.5, -14.5], RS: [44.0, 21.0],
  SL: [8.5, -11.8], SI: [46.2, 14.9], SO: [5.2, 46.2], ZA: [-29.0, 25.0],
  SS: [7.8, 29.7], ES: [40.5, -3.7], LK: [7.9, 80.8], SD: [12.9, 30.2],
  SE: [60.1, 18.6], CH: [47.0, 8.2], SY: [34.8, 38.8], TW: [23.7, 121.0],
  TJ: [38.9, 71.3], TZ: [-6.4, 34.9], TH: [15.9, 100.9], TG: [8.6, 0.8],
  TN: [33.9, 9.6], TR: [38.9, 35.2], TM: [38.9, 59.6], UG: [1.4, 32.3],
  UA: [49.0, 31.5], AE: [24.0, 54.0], GB: [55.4, -3.4], US: [37.1, -95.7],
  UY: [-32.5, -55.8], UZ: [41.4, 64.6], VE: [6.4, -66.6], VN: [14.1, 108.3],
  YE: [15.6, 48.5], ZM: [-13.1, 27.8], ZW: [-19.0, 29.2],
};

// ── Tone keyword sets ─────────────────────────────────────
const POSITIVE_WORDS = new Set([
  'sign', 'agreement', 'growth', 'peace', 'aid', 'support', 'success',
  'launch', 'investment', 'improve', 'recovery', 'boost', 'celebrate',
  'achieve', 'partner', 'cooperat', 'progress', 'surpass', 'award',
  'winner', 'record', 'expand', 'open', 'relief', 'rescue', 'save',
]);
const NEGATIVE_WORDS = new Set([
  'kill', 'dead', 'death', 'attack', 'crisis', 'explo', 'protest',
  'conflict', 'arrest', 'clash', 'shortage', 'sanction', 'flood',
  'fire', 'war', 'coup', 'violence', 'terror', 'shoot', 'bomb',
  'disaster', 'riot', 'victim', 'injur', 'wound', 'threat', 'accuse',
  'corrupt', 'scandal', 'resign', 'fall', 'fail', 'collapse',
]);

// ── Event type keyword sets ───────────────────────────────
const EVENT_TYPE_PATTERNS = [
  {
    type: 'Military',
    words: ['military', 'army', 'war', 'troops', 'missile', 'drone', 'naval',
      'airstrike', 'weapon', 'defence', 'defense', 'combat', 'soldier',
      'armed forces', 'bomb', 'explosion', 'rocket', 'artillery'],
  },
  {
    type: 'Economy',
    words: ['economy', 'inflation', 'gdp', 'stock', 'market', 'bank', 'trade',
      'price', 'jobs', 'unemployment', 'fiscal', 'budget', 'currency',
      'debt', 'revenue', 'export', 'import', 'finance', 'investment',
      'growth', 'recession', 'crypto', 'oil', 'energy', 'business', 'tariff',
      'interest rate', 'rate cut', 'rate hike', 'central bank', 'federal reserve',
      'ecb', 'imf', 'world bank', 'bond', 'yield', 'treasury', 'earnings',
      'quarterly results', 'merger', 'acquisition', 'ipo', 'startup', 'manufacturing',
      'industrial output', 'supply chain', 'consumer spending', 'retail sales',
      'housing market', 'real estate', 'mortgage', 'commodity', 'gold', 'gas',
      'electricity prices', 'shipping', 'logistics', 'trade deficit', 'surplus',
      'sanctions', 'subsidy', 'tax', 'wages', 'salary', 'cost of living'],
  },
  {
    type: 'Crime',
    words: ['crime', 'murder', 'homicide', 'robbery', 'theft', 'fraud', 'scam',
      'gang', 'cartel', 'kidnap', 'kidnapping', 'arrest', 'police', 'court',
      'trial', 'sentence', 'prison', 'jail', 'investigation', 'corruption'],
  },
  {
    type: 'Sports',
    words: ['sport', 'football', 'soccer', 'basketball', 'tennis', 'cricket',
      'baseball', 'hockey', 'olympic', 'fifa', 'uefa', 'nba', 'nfl', 'mlb',
      'championship', 'tournament', 'athlete', 'coach', 'match', 'league',
      'world cup', 'champions league', 'europa league', 'premier league', 'la liga',
      'serie a', 'bundesliga', 'ligue 1', 'grand slam', 'atp', 'wta', 'formula 1',
      'f1', 'motogp', 'ufc', 'boxing', 'mma', 'golf', 'pga', 'lpga', 'rugby',
      'volleyball', 'badminton', 'table tennis', 'esports', 'medal', 'playoff',
      'final', 'semifinal', 'quarterfinal', 'draw', 'fixture', 'transfer', 'draft',
      'manager', 'club', 'team', 'goal', 'hat-trick', 'penalty'],
  },
  {
    type: 'Politics',
    words: ['election', 'vote', 'parliament', 'president', 'prime minister',
      'government', 'party', 'political', 'senate', 'congress', 'minister',
      'cabinet', 'legislation', 'law', 'policy', 'campaign', 'ballot',
      'referendum', 'opposition', 'coalition'],
  },
  {
    type: 'Diplomacy',
    words: ['summit', 'treaty', 'diplomatic', 'ambassador', 'negotiat',
      'agreement', 'talks', 'sanction', 'united nations', 'nato', 'eu',
      'bilateral', 'multilateral', 'foreign minister', 'embassy'],
  },
  {
    type: 'Environment',
    words: ['climate', 'environment', 'flood', 'earthquake', 'wildfire',
      'hurricane', 'pollution', 'carbon', 'emissions', 'drought',
      'storm', 'typhoon', 'cyclone', 'temperature', 'glacier'],
  },
  {
    type: 'Society',
    words: ['health', 'education', 'school', 'university', 'hospital',
      'culture', 'social', 'community', 'religious',
      'church', 'mosque', 'protest', 'human rights', 'migrant',
      'refugee', 'poverty', 'covid', 'virus', 'vaccine', 'police'],
  },
];

const SPORTS_STRONG_TERMS = [
  'football', 'soccer', 'basketball', 'tennis', 'cricket', 'baseball', 'hockey',
  'rugby', 'golf', 'boxing', 'mma', 'ufc', 'formula 1', 'f1', 'motogp',
  'olympic', 'fifa', 'uefa', 'nba', 'nfl', 'mlb', 'nhl', 'world cup',
  'champions league', 'europa league', 'premier league', 'la liga', 'serie a',
  'bundesliga', 'ligue 1', 'grand slam', 'atp', 'wta', 'pga', 'lpga',
  'playoff', 'quarterfinal', 'semifinal', 'final', 'hat-trick',
];

const SPORTS_WEAK_TERMS = [
  'athlete', 'coach', 'match', 'league', 'tournament', 'championship', 'club',
  'team', 'goal', 'penalty', 'fixture', 'transfer', 'draft',
];

const SPORTS_EXCLUSION_TERMS = [
  'election', 'parliament', 'prime minister', 'president', 'congress',
  'senate', 'inflation', 'gdp', 'interest rate', 'bank', 'central bank',
  'trade deficit', 'homicide', 'murder', 'fraud', 'corruption', 'court',
  'trial', 'police', 'arrest', 'sentence', 'investigation', 'earthquake',
  'wildfire', 'hurricane',
];

const COUNTRY_TOPIC_ALIASES = {
  US: ['united states', 'u.s.', 'usa', 'america', 'american'],
  GB: ['united kingdom', 'uk', 'britain', 'british', 'england'],
  AE: ['united arab emirates', 'uae', 'emirati'],
  KR: ['south korea', 'korea', 'korean'],
  KP: ['north korea', 'korea', 'korean'],
  CZ: ['czech republic', 'czechia', 'czech'],
  DO: ['dominican republic', 'dominican'],
  SV: ['el salvador', 'salvadoran'],
  FR: ['france', 'french'],
  ES: ['spain', 'spanish'],
  AT: ['austria', 'austrian'],
  AU: ['australia', 'australian'],
  CN: ['china', 'chinese'],
  DE: ['germany', 'german'],
  IT: ['italy', 'italian'],
  PT: ['portugal', 'portuguese'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Low-level fetch helpers
// ─────────────────────────────────────────────────────────────────────────────

/** fetch() with an AbortController timeout so we never hang indefinitely. */
async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  await waitForGdeltSlot();

  const { statusCode, body } = await httpGetWithTimeout(url, timeoutMs, {
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    'User-Agent': 'News-Globe/1.0 (+https://localhost)',
  });

  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    text: async () => body,
  };
}

/** Safely read JSON from a Response — returns null instead of throwing. */
async function safeJson(res) {
  try {
    const text = await res.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return { __rawText: text };
    }
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main entry point — fetch articles and tone series for a country.
 *
 * @param {string} countryCode - ISO-2 code (e.g. "us")
 * @param {string} countryName - Full name (e.g. "United States")
 * @param {object} opts
 * @param {'24h'|'3d'|'7d'|'14d'|'30d'} [opts.dateRange='7d']
 * @param {'all'|'positive'|'neutral'|'negative'} [opts.tone='all']
 * @param {string} [opts.eventType='all']
 * @param {number} [opts.maxRecords=75]
 * @returns {Promise<{articles: object[], toneSeries: object[], error: string|null}>}
 */
export async function fetchCountryEvents(countryCode, countryName, opts = {}) {
  const {
    dateRange = '7d',
    tone = 'all',
    eventType = 'all',
    maxRecords = 75,
  } = opts;

  const cacheKey = `${CACHE_SCHEMA_VERSION}:${normalizeKey(countryName || countryCode)}:${dateRange}`;
  const countryKey = `${CACHE_SCHEMA_VERSION}:${normalizeKey(countryName || countryCode)}`;
  const cached = _cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    const filtered = applyFilters(cached.articles, tone, eventType);
    return { articles: filtered, toneSeries: cached.toneSeries, error: null };
  }
  const stale = cached || null;

  let basePromise = _inflight.get(cacheKey);
  if (!basePromise) {
    const timespan = dateRangeToTimespan(dateRange);
    basePromise = fetchCountryEventsBase(countryCode, countryName, {
      timespan,
      eventType: 'all',
      maxRecords,
      cacheKey,
    });
    _inflight.set(cacheKey, basePromise);
  }

  const base = await basePromise;
  if (base.error && stale && stale.articles?.length) {
    const filteredStale = applyFilters(stale.articles, tone, eventType);
    return {
      articles: filteredStale,
      toneSeries: stale.toneSeries || [],
      error: 'Using cached events because live fetch timed out.',
    };
  }
  if (base.error && !stale) {
    const last = _lastSuccessByCountry.get(countryKey);
    if (last?.articles?.length) {
      const filteredLast = applyFilters(last.articles, tone, eventType);
      return {
        articles: filteredLast,
        toneSeries: last.toneSeries || [],
        error: 'Using previously cached country events because live source is rate-limited.',
      };
    }
    const message = normalizeLiveError(base.error);
    return {
      articles: [],
      toneSeries: [],
      error: message,
    };
  }
  const filtered = applyFilters(base.articles, tone, eventType);
  if (filtered.length === 0 && eventType !== 'all' && base.articles?.length > 0) {
    return {
      articles: applyFilters(base.articles, tone, 'all').slice(0, 25),
      toneSeries: base.toneSeries,
      error: `No ${eventType} outlets found right now; showing latest in-country sources instead.`,
    };
  }
  return { articles: filtered, toneSeries: base.toneSeries, error: base.error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchGdeltArticles(countryCode, countryName, { timespan, eventType, maxRecords }) {
  const baseParams = {
    mode: 'artlist',
    maxrecords: String(maxRecords),
    timespan,
    sort: 'DateDesc',
    format: 'json',
  };

  const queries = buildGdeltQueries(countryCode, countryName, eventType);
  let lastError = null;
  const combined = [];
  const seen = new Set();

  try {
    for (const query of queries) {
      const params = new URLSearchParams({ ...baseParams, query });
      const res = await fetchWithBackoffOn429(`${GDELT_DOC_URL}?${params}`);
      if (!res.ok) {
        lastError = `GDELT responded with HTTP ${res.status}`;
        continue;
      }

      const data = await safeJson(res);
      if (isGdeltRateLimitResponse(data)) {
        return { articles: [], error: 'GDELT rate limit reached. Please retry in a few seconds.' };
      }

      const articles = data?.articles;
      if (Array.isArray(articles) && articles.length > 0) {
        const strict = articles.filter((a) => isSourceCountryMatch(a, countryCode, countryName));
        for (const a of strict) {
          const key = a?.url || `${a?.title || ''}:${a?.seendate || ''}`;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          combined.push(a);
        }
        if (combined.length >= Math.min(maxRecords, 120)) break;
      }
    }
    if (combined.length > 0) {
      return { articles: combined, error: null };
    }
    return { articles: [], error: lastError || 'No in-country sources found for this country/time range.' };
  } catch (err) {
    return { articles: [], error: `GDELT fetch failed: ${formatFetchError(err)}` };
  }
}

async function fetchWithBackoffOn429(url) {
  let res = await fetchWithTimeout(url);
  if (res.status === 429) {
    await sleep(GDELT_RATE_LIMIT_BACKOFF_MS);
    res = await fetchWithTimeout(url);
  }
  return res;
}

function buildToneSeriesFromArticles(articles) {
  const buckets = new Map();

  for (const article of articles) {
    const iso = article.publishedAt;
    if (!iso) continue;

    const dayKey = iso.slice(0, 10); // YYYY-MM-DD
    const prev = buckets.get(dayKey) || { sum: 0, count: 0 };
    prev.sum += toneToNumeric(article.tone);
    prev.count += 1;
    buckets.set(dayKey, prev);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dayKey, value]) => {
      const [y, m, d] = dayKey.split('-');
      const display = new Date(`${y}-${m}-${d}`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      // Scale average tone from [-1, 1] into [-10, 10] for chart readability.
      const avg = value.count ? (value.sum / value.count) * 10 : 0;
      return { date: display, tone: Math.round(avg * 10) / 10 };
    });
}

function transformGdeltArticle(raw, index, countryName, coordinates) {
  const title = raw.title || 'No title available';
  const description = raw.description || title;
  const content = `${title} ${raw.description || ''} ${raw.content || ''}`.trim();
  const tone = classifyToneFromTitle(title);
  const eventType = classifyEventType(content);

  return {
    id: `gdelt-${index}-${Date.now()}`,
    title,
    description,
    source: raw.domain || 'Unknown Source',
    sourcecountry: normalizeCountryDisplayName(raw.sourcecountry || ''),
    url: raw.url || '#',
    publishedAt: parseGdeltDate(raw.seendate),
    imageUrl: raw.socialimage || null,
    content,
    // GDELT-specific fields
    tone,
    eventType,
    country: countryName,
    coordinates: coordinates ? `${coordinates[0]},${coordinates[1]}` : null,
  };
}

function applyFilters(articles, tone, eventType) {
  let result = articles;

  if (tone && tone !== 'all') {
    result = result.filter((a) => a.tone === tone);
  }

  if (eventType && eventType !== 'all') {
    result = result.filter((a) => a.eventType === eventType);
  }

  // Keep list in recency order: newest first, oldest at the end.
  result.sort((a, b) => {
    const ta = Date.parse(a.publishedAt || '') || 0;
    const tb = Date.parse(b.publishedAt || '') || 0;
    return tb - ta;
  });

  return diversifyBySource(result);
}

function toneToNumeric(tone) {
  if (tone === 'positive') return 1;
  if (tone === 'negative') return -1;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Classification helpers
// ─────────────────────────────────────────────────────────────────────────────

function classifyToneFromTitle(title) {
  if (!title) return 'neutral';
  const lower = title.toLowerCase();

  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) return 'negative';
  }
  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) return 'positive';
  }
  return 'neutral';
}

function classifyEventType(title) {
  if (!title) return 'General';
  const lower = title.toLowerCase();

  if (isLikelySportsText(lower)) {
    return 'Sports';
  }

  for (const { type, words } of EVENT_TYPE_PATTERNS) {
    if (type === 'Sports') continue;
    for (const word of words) {
      if (lower.includes(word)) return type;
    }
  }
  return 'General';
}

function isLikelySportsText(lowerText) {
  let score = 0;
  let strongHits = 0;
  for (const term of SPORTS_STRONG_TERMS) {
    if (lowerText.includes(term)) {
      score += 2;
      strongHits += 1;
    }
  }
  for (const term of SPORTS_WEAK_TERMS) {
    if (lowerText.includes(term)) score += 1;
  }

  // If the text is heavy on non-sports domains, demand stronger sports evidence.
  let nonSportsHits = 0;
  for (const term of SPORTS_EXCLUSION_TERMS) {
    if (lowerText.includes(term)) nonSportsHits += 1;
  }

  if (nonSportsHits >= 2) return strongHits >= 1 && score >= 4;
  if (strongHits >= 1) return score >= 2;
  return score >= 4;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date/format helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseGdeltDate(seendate) {
  if (!seendate) return new Date().toISOString();
  // GDELT format: 20250115T120000Z
  const m = seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!m) return new Date().toISOString();
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

function dateRangeToTimespan(dateRange) {
  const map = { '24h': '1d', '3d': '3d', '7d': '7d', '14d': '14d', '30d': '30d' };
  return map[dateRange] || '7d';
}

async function fetchCountryEventsBase(countryCode, countryName, { timespan, eventType, maxRecords, cacheKey }) {
  try {
    // Single external fetch path (artlist) to reduce rate-limit pressure.
    let articlesResult = await fetchGdeltArticles(countryCode, countryName, { timespan, eventType, maxRecords });

    // Hard fallback: if GDELT fails, use NewsAPI country endpoint.
    let fallbackSource = null;
    if (articlesResult.error && articlesResult.articles.length === 0) {
      let fallback = await fetchNewsApiSourcesFallback(countryCode, countryName, { maxRecords, eventType });
      if (fallback.articles.length === 0) {
        fallback = await fetchNewsApiFallback(countryCode, countryName, { maxRecords });
      }
      if (fallback.articles.length > 0) {
        articlesResult = fallback;
        fallbackSource = 'newsapi';
      } else {
        return { articles: [], toneSeries: [], error: `${articlesResult.error} (country-local fallback unavailable)` };
      }
    }

    const coords = COUNTRY_CENTROIDS[countryCode?.toUpperCase()] || null;
    const normalizedAll = articlesResult.articles.map((raw, i) =>
      transformGdeltArticle(raw, i, countryName, coords)
    );
    const sourceMatched = filterByCountrySource(normalizedAll, countryCode, countryName);
    const normalized = filterByCountryTopic(sourceMatched, countryCode, countryName);
    const toneSeries = buildToneSeriesFromArticles(normalized);

    _cache.set(cacheKey, {
      articles: normalized,
      toneSeries,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    _lastSuccessByCountry.set(`${CACHE_SCHEMA_VERSION}:${normalizeKey(countryName || countryCode)}`, {
      articles: normalized,
      toneSeries,
      savedAt: Date.now(),
    });

    return {
      articles: normalized,
      toneSeries,
      error: fallbackSource
        ? `GDELT unavailable; showing ${fallbackSource} fallback data.`
        : null,
    };
  } finally {
    _inflight.delete(cacheKey);
  }
}

function isGdeltRateLimitResponse(data) {
  const raw = data?.__rawText;
  return typeof raw === 'string' && raw.toLowerCase().includes('limit requests');
}

function buildGdeltQueries(countryCode, countryName) {
  const name = normalizeCountryDisplayName(countryName);
  const code = String(countryCode || '').toUpperCase();
  const queries = [];
  const gdeltSourceCode = ISO_TO_GDELT_COUNTRY_CODE[code] || code;

  if (name) {
    // Primary: sourcecountry queries to enforce country-local outlets.
    if (gdeltSourceCode) {
      queries.push(`sourcecountry:${gdeltSourceCode} sourcelang:English`.trim());
    } else {
      queries.push(`sourcecountry:${name} sourcelang:English`.trim());
    }
  }

  // Keep exactly one strict query path per request to minimize rate limiting.
  return [...new Set(queries)];
}

function escapeGdeltPhrase(value) {
  return String(value || '').replace(/["\\]/g, '').trim();
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ISO_TO_GDELT_COUNTRY_CODE = {
  US: 'US',
  GB: 'UK',
  AE: 'AE',
  NZ: 'NZ',
  ZA: 'SF',
  KR: 'KS',
  KP: 'KN',
  CZ: 'EZ',
  DO: 'DR',
  SV: 'ES',
};
const ISO_TO_SOURCECOUNTRY_NAME = {
  US: 'United States',
  GB: 'United Kingdom',
  AE: 'United Arab Emirates',
  KR: 'South Korea',
  KP: 'North Korea',
  CZ: 'Czech Republic',
  DO: 'Dominican Republic',
  SV: 'El Salvador',
};

function normalizeCountryDisplayName(name) {
  return String(name || '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGdeltSlot() {
  const run = async () => {
    const elapsed = Date.now() - _lastGdeltRequestAt;
    const waitMs = Math.max(0, MIN_GDELT_INTERVAL_MS - elapsed);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    _lastGdeltRequestAt = Date.now();
  };

  const next = _gdeltQueue.then(run, run);
  _gdeltQueue = next.catch(() => {});
  await next;
}

async function fetchNewsApiFallback(countryCode, countryName, { maxRecords = 50 } = {}) {
  if (!config.newsApiKey) {
    return { articles: [], error: 'NEWS_API_KEY not configured' };
  }

  const params = new URLSearchParams({
    country: String(countryCode || '').toLowerCase(),
    pageSize: String(Math.min(maxRecords, 100)),
    apiKey: config.newsApiKey,
  });

  try {
    const { statusCode, body } = await httpGetWithTimeout(
      `https://newsapi.org/v2/top-headlines?${params}`,
      20_000,
      {
        Accept: 'application/json',
        'User-Agent': 'News-Globe/1.0 (+https://localhost)',
      }
    );

    if (statusCode < 200 || statusCode >= 300) {
      return { articles: [], error: `NewsAPI responded with HTTP ${statusCode}` };
    }

    let data = null;
    try {
      data = JSON.parse(body);
    } catch {
      data = null;
    }
    const list = Array.isArray(data?.articles) ? data.articles : [];

    const articles = list
      .filter((a) => a?.title)
      .map((a, i) => ({
        title: a.title,
        description: a.description || '',
        content: a.content || '',
        domain: a.source?.name || a.url || 'Unknown Source',
        url: a.url || '#',
        seendate: toGdeltLikeDate(a.publishedAt),
        socialimage: a.urlToImage || null,
        sourcecountry: normalizeCountryDisplayName(countryName),
        _fallbackId: i,
      }));

    return { articles, error: null };
  } catch (err) {
    return { articles: [], error: `NewsAPI fallback failed: ${formatFetchError(err)}` };
  }
}

async function fetchNewsApiSourcesFallback(countryCode, countryName, { maxRecords = 50, eventType = 'all' } = {}) {
  if (!config.newsApiKey) {
    return { articles: [], error: 'NEWS_API_KEY not configured' };
  }

  const mappedCategory = mapEventTypeToNewsApiCategory(eventType);
  try {
    const allSources = await fetchNewsApiSourcesForCountry(countryCode);
    if (allSources.length === 0) {
      return { articles: [], error: 'No NewsAPI sources available for this country' };
    }

    const rankedSources = rankSourcesForEventType(allSources, mappedCategory);
    const sourceIds = rankedSources
      .map((s) => s?.id)
      .filter(Boolean)
      .slice(0, 20); // NewsAPI sources parameter limit.

    if (sourceIds.length === 0) {
      return { articles: [], error: 'No usable source IDs from NewsAPI' };
    }

    const headlinesParams = new URLSearchParams({
      sources: sourceIds.join(','),
      pageSize: String(Math.min(maxRecords, 100)),
      apiKey: config.newsApiKey,
    });

    const headlinesResp = await httpGetWithTimeout(
      `https://newsapi.org/v2/top-headlines?${headlinesParams}`,
      20_000,
      {
        Accept: 'application/json',
        'User-Agent': 'News-Globe/1.0 (+https://localhost)',
      }
    );

    if (headlinesResp.statusCode < 200 || headlinesResp.statusCode >= 300) {
      return { articles: [], error: `NewsAPI headlines responded with HTTP ${headlinesResp.statusCode}` };
    }

    let headlinesData = null;
    try {
      headlinesData = JSON.parse(headlinesResp.body);
    } catch {
      headlinesData = null;
    }

    const list = Array.isArray(headlinesData?.articles) ? headlinesData.articles : [];
    const filteredList = mappedCategory
      ? list.filter((a) => isArticleFromCategoryHint(a, mappedCategory))
      : list;

    const pool = filteredList.length >= 5 ? filteredList : list;
    const deduped = dedupeByUrl(pool).slice(0, maxRecords);

    const articles = deduped
      .filter((a) => a?.title)
      .map((a, i) => ({
        title: a.title,
        description: a.description || '',
        content: a.content || '',
        domain: a.source?.name || a.url || 'Unknown Source',
        url: a.url || '#',
        seendate: toGdeltLikeDate(a.publishedAt),
        socialimage: a.urlToImage || null,
        sourcecountry: normalizeCountryDisplayName(countryName),
        _fallbackId: i,
      }));

    return { articles, error: null };
  } catch (err) {
    return { articles: [], error: `NewsAPI sources fallback failed: ${formatFetchError(err)}` };
  }
}

async function fetchNewsApiSourcesForCountry(countryCode) {
  const country = String(countryCode || '').toLowerCase();
  const requests = [
    { country, language: 'en', apiKey: config.newsApiKey },
    { country, apiKey: config.newsApiKey },
  ];

  for (const paramsObj of requests) {
    const params = new URLSearchParams(paramsObj);
    const resp = await httpGetWithTimeout(
      `https://newsapi.org/v2/top-headlines/sources?${params}`,
      20_000,
      {
        Accept: 'application/json',
        'User-Agent': 'News-Globe/1.0 (+https://localhost)',
      }
    );

    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      continue;
    }

    let data = null;
    try {
      data = JSON.parse(resp.body);
    } catch {
      data = null;
    }

    const sources = Array.isArray(data?.sources) ? data.sources : [];
    if (sources.length > 0) {
      return sources;
    }
  }

  return [];
}

function mapEventTypeToNewsApiCategory(eventType) {
  const value = String(eventType || '').toLowerCase();
  if (value === 'sports') return 'sports';
  if (value === 'economy') return 'business';
  return null;
}

function rankSourcesForEventType(sources, category) {
  if (!Array.isArray(sources)) return [];
  if (!category) return sources;

  const preferred = sources.filter((s) => String(s?.category || '').toLowerCase() === category);
  const others = sources.filter((s) => String(s?.category || '').toLowerCase() !== category);
  return [...preferred, ...others];
}

function isArticleFromCategoryHint(article, category) {
  const text = `${article?.title || ''} ${article?.description || ''}`.toLowerCase();
  if (category === 'sports') {
    return /football|soccer|nba|nfl|mlb|nhl|tennis|cricket|olympic|tournament|league|match|athlete/.test(text);
  }
  if (category === 'business') {
    return /economy|inflation|market|stock|bank|trade|gdp|business|finance|investment|jobs|currency/.test(text);
  }
  return true;
}

function dedupeByUrl(articles) {
  const out = [];
  const seen = new Set();
  for (const article of articles || []) {
    const key = article?.url || `${article?.title || ''}:${article?.publishedAt || ''}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(article);
  }
  return out;
}

function toGdeltLikeDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function formatFetchError(err) {
  if (!err) return 'network error';
  if (err.name === 'AbortError') return 'request timed out';
  if (typeof err.message === 'string' && err.message.toLowerCase().includes('fetch failed')) {
    return 'network request failed';
  }
  return err.message || 'network error';
}

function normalizeLiveError(errorMessage) {
  const message = String(errorMessage || '');
  const lower = message.toLowerCase();

  if (
    lower.includes('429')
    || lower.includes('rate limit')
    || lower.includes('temporarily')
  ) {
    return 'Live country outlets are temporarily rate-limited. Please retry shortly.';
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Live country outlets timed out. Please retry shortly.';
  }

  return message || 'Live country outlets are temporarily unavailable.';
}

function diversifyBySource(articles, maxPerSource = 3) {
  if (!Array.isArray(articles) || articles.length === 0) return [];
  const grouped = new Map();
  for (const item of articles) {
    const source = item?.source || 'Unknown Source';
    if (!grouped.has(source)) grouped.set(source, []);
    grouped.get(source).push(item);
  }

  const sources = [...grouped.keys()];
  const result = [];
  let added = true;
  let round = 0;

  // Round-robin so one outlet does not dominate category views.
  while (added) {
    added = false;
    for (const source of sources) {
      const list = grouped.get(source);
      if (!list || list.length <= round || round >= maxPerSource) continue;
      result.push(list[round]);
      added = true;
    }
    round += 1;
  }

  return result;
}

function filterByCountrySource(articles, countryCode, countryName) {
  if (!Array.isArray(articles) || articles.length === 0) return [];
  return articles.filter((a) => isSourceCountryMatch(a, countryCode, countryName));
}

function filterByCountryTopic(articles, countryCode, countryName) {
  if (!Array.isArray(articles) || articles.length === 0) return [];
  const matcher = buildCountryTopicMatcher(countryCode, countryName);
  if (!matcher) return articles;

  // Prefer country-mentioned stories, but never collapse to empty if local outlets
  // do not include the country name in every headline.
  const ranked = [...articles].sort((a, b) => {
    const aScore = matcher(countryTopicText(a)) ? 1 : 0;
    const bScore = matcher(countryTopicText(b)) ? 1 : 0;
    return bScore - aScore;
  });
  return ranked;
}

function isSourceCountryMatch(article, countryCode, countryName) {
  const sourceCountry = normalizeCountryDisplayName(article?.sourcecountry || '').toLowerCase();
  if (!sourceCountry) return false;

  const targets = new Set();
  const byName = normalizeCountryDisplayName(countryName).toLowerCase();
  if (byName) targets.add(byName);
  const alias = normalizeCountryDisplayName(
    ISO_TO_SOURCECOUNTRY_NAME[String(countryCode || '').toUpperCase()] || ''
  ).toLowerCase();
  if (alias) targets.add(alias);

  return targets.has(sourceCountry);
}

function buildCountryTopicMatcher(countryCode, countryName) {
  const code = String(countryCode || '').toUpperCase();
  const aliases = new Set();

  const normalizedName = normalizeCountryDisplayName(countryName).toLowerCase();
  if (normalizedName) aliases.add(normalizedName);

  const sourceAlias = normalizeCountryDisplayName(
    ISO_TO_SOURCECOUNTRY_NAME[code] || ''
  ).toLowerCase();
  if (sourceAlias) aliases.add(sourceAlias);

  for (const alias of COUNTRY_TOPIC_ALIASES[code] || []) {
    const cleaned = normalizeCountryDisplayName(alias).toLowerCase();
    if (cleaned) aliases.add(cleaned);
  }

  if (aliases.size === 0) return null;
  const patterns = [...aliases].map((alias) => aliasToRegex(alias));
  return (text) => patterns.some((re) => re.test(text));
}

function aliasToRegex(alias) {
  const escaped = escapeRegExp(alias).replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countryTopicText(article) {
  const title = String(article?.title || '');
  const description = String(article?.description || '');
  const content = String(article?.content || '');
  return `${title} ${description} ${content}`.toLowerCase();
}

async function httpGetWithTimeout(url, timeoutMs, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        headers,
        family: 4, // Avoid IPv6 connect stalls seen with undici/fetch in some environments.
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 0, body });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('request timed out'));
    });

    req.on('error', reject);
    req.end();
  });
}
