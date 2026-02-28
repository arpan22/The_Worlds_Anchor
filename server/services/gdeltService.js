/**
 * GDELT Service — Country news via the GDELT Doc 2.0 API
 *
 * No API key required. GDELT is a free, public dataset.
 *
 * Endpoints used:
 *   mode=artlist          — Article list with URL, title, domain, date
 *   mode=timelinetonechart — Tone-over-time series for Recharts
 *
 * Rate limit: Be polite — max ~5 req/sec. Cache results for 8 minutes.
 */

const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes
const FETCH_TIMEOUT_MS = 30_000;     // 30 s per request

// In-memory cache: key → { articles, toneSeries, expiresAt }
const _cache = new Map();

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
      'growth', 'recession', 'crypto', 'oil', 'energy'],
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
      'crime', 'culture', 'sport', 'social', 'community', 'religious',
      'church', 'mosque', 'protest', 'human rights', 'migrant',
      'refugee', 'poverty', 'covid', 'virus', 'vaccine', 'police'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Low-level fetch helpers
// ─────────────────────────────────────────────────────────────────────────────

/** fetch() with an AbortController timeout so we never hang indefinitely. */
async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Safely read JSON from a Response — returns null instead of throwing. */
async function safeJson(res) {
  try {
    return await res.json();
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
 * @param {'24h'|'3d'|'7d'|'30d'} [opts.dateRange='7d']
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

  const cacheKey = `${countryName.toLowerCase()}:${dateRange}`;
  const cached = _cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    const filtered = applyFilters(cached.articles, tone, eventType);
    return { articles: filtered, toneSeries: cached.toneSeries, error: null };
  }

  const timespan = dateRangeToTimespan(dateRange);

  // Sequential fetches — GDELT rate-limits concurrent requests from the same IP.
  const articlesResult = await fetchGdeltArticles(countryName, { timespan, maxRecords });
  const toneSeries = await fetchGdeltToneSeries(countryName, timespan);

  if (articlesResult.error && articlesResult.articles.length === 0) {
    return { articles: [], toneSeries: [], error: articlesResult.error };
  }

  const coords = COUNTRY_CENTROIDS[countryCode?.toUpperCase()] || null;
  const normalized = articlesResult.articles.map((raw, i) =>
    transformGdeltArticle(raw, i, countryName, coords)
  );

  _cache.set(cacheKey, {
    articles: normalized,
    toneSeries,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  const filtered = applyFilters(normalized, tone, eventType);
  return { articles: filtered, toneSeries, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchGdeltArticles(countryName, { timespan, maxRecords }) {
  const baseParams = {
    mode: 'artlist',
    maxrecords: String(maxRecords),
    timespan,
    sort: 'DateDesc',
    format: 'json',
  };

  try {
    // First attempt: English-language articles only
    const p1 = new URLSearchParams({ ...baseParams, query: `"${countryName}" sourcelang:English` });
    const res1 = await fetchWithTimeout(`${GDELT_DOC_URL}?${p1}`);
    if (!res1.ok) throw new Error(`GDELT responded with HTTP ${res1.status}`);

    const data1 = await safeJson(res1);
    const articles = data1?.articles || [];

    // Fallback: drop language filter if too few English results
    if (articles.length < 5) {
      const p2 = new URLSearchParams({ ...baseParams, query: `"${countryName}"` });
      try {
        const res2 = await fetchWithTimeout(`${GDELT_DOC_URL}?${p2}`);
        if (res2.ok) {
          const data2 = await safeJson(res2);
          const fallbackArticles = data2?.articles;
          if (Array.isArray(fallbackArticles) && fallbackArticles.length > 0) {
            return { articles: fallbackArticles, error: null };
          }
        }
      } catch {
        // Fallback failed — return whatever the first request found (may be empty)
      }
    }

    return { articles, error: null };
  } catch (err) {
    return { articles: [], error: `GDELT fetch failed: ${err.message}` };
  }
}

async function fetchGdeltToneSeries(countryName, timespan) {
  const params = new URLSearchParams({
    query: `"${countryName}" sourcelang:English`,
    mode: 'timelinetonechart',
    timespan,
    format: 'json',
  });

  try {
    const res = await fetchWithTimeout(`${GDELT_DOC_URL}?${params}`);
    if (!res.ok) return [];

    const data = await safeJson(res);
    const timeline = data?.timeline || [];

    return timeline.map((point) => ({
      date: formatChartDate(point.date),
      tone: typeof point.value === 'number' ? Math.round(point.value * 10) / 10 : 0,
    }));
  } catch {
    return [];
  }
}

function transformGdeltArticle(raw, index, countryName, coordinates) {
  const title = raw.title || 'No title available';
  const tone = classifyToneFromTitle(title);
  const eventType = classifyEventType(title);

  return {
    id: `gdelt-${index}-${Date.now()}`,
    title,
    description: title, // GDELT artlist has no description field
    source: raw.domain || 'Unknown Source',
    url: raw.url || '#',
    publishedAt: parseGdeltDate(raw.seendate),
    imageUrl: raw.socialimage || null,
    content: title,
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

  return result;
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

  for (const { type, words } of EVENT_TYPE_PATTERNS) {
    for (const word of words) {
      if (lower.includes(word)) return type;
    }
  }
  return 'General';
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

function formatChartDate(gdeltDate) {
  if (!gdeltDate) return '';
  const m = gdeltDate.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return gdeltDate;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dateRangeToTimespan(dateRange) {
  const map = { '24h': '1d', '3d': '3d', '7d': '7d', '30d': '30d' };
  return map[dateRange] || '7d';
}
