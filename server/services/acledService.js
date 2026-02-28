/**
 * ACLED Service
 *
 * Fetches armed conflict and protest event data from the ACLED API.
 * Implements server-side in-memory caching (15-minute TTL).
 *
 * Attribution (required by ACLED ToU): "Data: ACLED"
 * Docs: https://developer.acleddata.com
 *
 * Required env vars:
 *   ACLED_API_KEY — your ACLED API key
 *   ACLED_EMAIL   — email address registered with ACLED
 */
import { config } from '../config/index.js';

const ACLED_BASE = 'https://api.acleddata.com/acled/read.php';
const MAX_PER_PAGE = 500;
const MAX_PAGES = 4; // cap at 2,000 events per request
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_SIZE = 200;

// In-memory cache: key → { data: Event[], ts: number }
const _cache = new Map();

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a raw ACLED record to our internal schema.
 * Sanitizes strings, caps notes length, coerces numeric fields.
 */
function normalize(raw) {
  return {
    event_id:
      raw.event_id_cnty ||
      `${raw.country}|${raw.event_date}|${raw.latitude}|${raw.longitude}`,
    event_date: raw.event_date || null,
    event_type: (raw.event_type || 'Unknown').trim(),
    sub_event_type: (raw.sub_event_type || '').trim(),
    actor1: (raw.actor1 || '').trim(),
    actor2: (raw.actor2 || '').trim(),
    fatalities:
      raw.fatalities != null ? Math.max(0, parseInt(raw.fatalities, 10) || 0) : 0,
    location: (raw.location || '').trim(),
    admin1: (raw.admin1 || '').trim(),
    admin2: (raw.admin2 || '').trim(),
    country: (raw.country || '').trim(),
    latitude: raw.latitude != null ? parseFloat(raw.latitude) : null,
    longitude: raw.longitude != null ? parseFloat(raw.longitude) : null,
    geo_precision:
      raw.geo_precision != null ? parseInt(raw.geo_precision, 10) : null,
    source: (raw.source || '').trim(),
    notes: (raw.notes || '').trim().slice(0, 800),
  };
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function makeCacheKey({ country, start_date, end_date, event_type = '', actor = '', admin1 = '' }) {
  return `${country}|${start_date}|${end_date}|${event_type}|${actor}|${admin1}`;
}

function cacheGet(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  _cache.delete(key);
  return null;
}

function cachePut(key, data) {
  // Simple eviction: remove oldest entry when cache is full
  if (_cache.size >= MAX_CACHE_SIZE) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
  _cache.set(key, { data, ts: Date.now() });
}

// ─── URL builder ──────────────────────────────────────────────────────────────

function buildUrl({ country, start_date, end_date, event_type, actor, admin1, page }) {
  const p = new URLSearchParams({
    key: config.acledApiKey,
    email: config.acledEmail,
    event_date: `${start_date}|${end_date}`,
    event_date_where: 'BETWEEN',
    limit: String(MAX_PER_PAGE),
    page: String(page),
    fields: [
      'event_id_cnty',
      'event_date',
      'event_type',
      'sub_event_type',
      'actor1',
      'actor2',
      'admin1',
      'admin2',
      'location',
      'latitude',
      'longitude',
      'fatalities',
      'source',
      'notes',
      'country',
      'geo_precision',
    ].join('|'),
  });
  if (country) p.append('country', country);
  if (event_type) p.append('event_type', event_type);
  if (actor) p.append('actor1', actor); // ACLED does substring match on actor1
  if (admin1) p.append('admin1', admin1);
  return `${ACLED_BASE}?${p}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch ACLED events for a country/date range, with pagination and caching.
 *
 * @param {object} params
 * @param {string} params.country       Full ACLED country name, e.g. "Ukraine"
 * @param {string} params.start_date    ISO date "YYYY-MM-DD"
 * @param {string} params.end_date      ISO date "YYYY-MM-DD"
 * @param {string} [params.event_type]  ACLED event type filter
 * @param {string} [params.actor]       Actor name substring
 * @param {string} [params.admin1]      Admin1 region filter
 * @param {number} [params.fatalities_min] Minimum fatalities (applied client-side)
 * @returns {Promise<{ events: object[], total: number, cached: boolean }>}
 */
export async function fetchAcledEvents(params) {
  const { country, start_date, end_date, event_type, actor, admin1, fatalities_min } = params;

  if (!config.acledApiKey || !config.acledEmail) {
    throw new Error('ACLED_API_KEY and ACLED_EMAIL env vars are required.');
  }

  const key = makeCacheKey(params);
  const cached = cacheGet(key);
  if (cached) {
    console.log(`[ACLED] Cache hit: ${country} ${start_date}–${end_date}`);
    return { events: cached, total: cached.length, cached: true };
  }

  const all = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = buildUrl({ country, start_date, end_date, event_type, actor, admin1, page });
    console.log(`[ACLED] Fetching page ${page} for ${country} (${start_date}–${end_date})`);

    let resp;
    try {
      resp = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12_000),
      });
    } catch (err) {
      throw new Error(`ACLED network error: ${err.message}`);
    }

    if (resp.status === 429) {
      console.warn('[ACLED] Rate limited — returning partial results');
      break;
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`ACLED API ${resp.status}: ${body.slice(0, 300)}`);
    }

    let json;
    try {
      json = await resp.json();
    } catch {
      throw new Error('ACLED returned non-JSON response.');
    }

    if (json.status === 400 || json.status === 401) {
      throw new Error(`ACLED API error: ${json.error || json.message || 'bad request/auth'}`);
    }
    if (!Array.isArray(json.data) || json.data.length === 0) break;

    all.push(...json.data.map(normalize));

    if (json.data.length < MAX_PER_PAGE) break; // no more pages
  }

  // Apply optional client-side fatalities floor
  const events =
    fatalities_min != null
      ? all.filter((e) => e.fatalities >= parseInt(fatalities_min, 10))
      : all;

  cachePut(key, events);
  return { events, total: events.length, cached: false };
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Compute summary statistics from a normalized event array.
 * Returns timeline (per-day), typeBreakdown, and topActors.
 */
export function computeAggregates(events) {
  const byDay = {};
  const byType = {};
  const actorMap = {};

  for (const e of events) {
    const d = e.event_date || 'unknown';
    if (!byDay[d]) byDay[d] = { date: d, count: 0, fatalities: 0 };
    byDay[d].count++;
    byDay[d].fatalities += e.fatalities;

    const t = e.event_type;
    if (!byType[t]) byType[t] = { type: t, count: 0, fatalities: 0 };
    byType[t].count++;
    byType[t].fatalities += e.fatalities;

    const bump = (name) => {
      if (!name) return;
      actorMap[name] = (actorMap[name] || 0) + 1;
    };
    bump(e.actor1);
    bump(e.actor2);
  }

  const timeline = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  const typeBreakdown = Object.values(byType).sort((a, b) => b.count - a.count);
  const topActors = Object.entries(actorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return { timeline, typeBreakdown, topActors };
}

// ─── Static metadata ──────────────────────────────────────────────────────────

export function getEventTypes() {
  return [
    { value: '', label: 'All Types' },
    { value: 'Battles', label: 'Battles' },
    { value: 'Explosions/Remote violence', label: 'Explosions / Remote Violence' },
    { value: 'Violence against civilians', label: 'Violence Against Civilians' },
    { value: 'Protests', label: 'Protests' },
    { value: 'Riots', label: 'Riots' },
    { value: 'Strategic developments', label: 'Strategic Developments' },
  ];
}
