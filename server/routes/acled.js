/**
 * ACLED Routes — Conflict & Protest data
 *
 * GET /api/acled/events    — Fetch events for a country/date range
 * GET /api/acled/types     — Return the ACLED event type taxonomy
 * GET /api/acled/countries — Return country list from local data (for FilterBar)
 *
 * Priority:
 *   1. Live ACLED API  (when ACLED_API_KEY + ACLED_EMAIL are set)
 *   2. Local xlsx data (automatic fallback — bundled in server/data/)
 *
 * Attribution: "Data: ACLED (Armed Conflict Location & Event Data Project)"
 * See: https://acleddata.com
 */
import { Router } from 'express';
import { config } from '../config/index.js';
import {
  fetchAcledEvents,
  computeAggregates,
  getEventTypes,
} from '../services/acledService.js';
import {
  queryLocalAcled,
  getLocalCountries,
  isLocalDataAvailable,
} from '../services/acledLocalService.js';

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ATTRIBUTION = 'Data: ACLED (Armed Conflict Location & Event Data Project) — acleddata.com';

// Detect which source we'll use (logged once at startup)
const hasApiKey = Boolean(config.acledApiKey && config.acledEmail);
let _localAvailable = null; // lazily checked

function useLocalData() {
  if (hasApiKey) return false;
  if (_localAvailable === null) {
    _localAvailable = isLocalDataAvailable();
    if (_localAvailable) {
      console.log('[ACLED] No API key — using bundled xlsx data (server/data/)');
    } else {
      console.warn('[ACLED] No API key and no local data found in server/data/');
    }
  }
  return _localAvailable;
}

function buildLocalResponse(country, start_date, end_date, liveError = null, filters = {}) {
  const trimmedCountry = String(country || '').trim();
  const isGlobalQuery = !trimmedCountry;
  const hasNonCountryFilters = Boolean(
    filters.event_type || filters.actor || filters.admin1 || filters.fatalities_min != null
  );

  const result = queryLocalAcled({ country: trimmedCountry, start_date, end_date });
  const liveFallbackNote = liveError
    ? `Live ACLED API unavailable, showing bundled ACLED data instead. ${liveError}`
    : null;

  if (result.total === 0 && result.events.length === 0) {
    return {
      events: [],
      total: 0,
      cached: false,
      aggregates: { timeline: [], typeBreakdown: [], topActors: [] },
      source: 'local-xlsx',
      dataNote:
        liveFallbackNote ||
        (isGlobalQuery
          ? 'No bundled political violence data was found for the selected date range.'
          : `No data found for "${trimmedCountry}" in the selected range. The bundled dataset covers 2017–Feb 2026. Check the country name exactly (e.g. "Democratic Republic of Congo", "eSwatini").`),
      attribution: ATTRIBUTION,
    };
  }

  const localNote = liveFallbackNote
    ? `${liveFallbackNote} Local fallback uses bundled monthly political-violence data and may not reflect actor/type filters.`
    : null;

  const noteWithFilterWarning = hasNonCountryFilters
    ? `${localNote ? `${localNote} ` : ''}Bundled fallback data does not support protest-type, actor, admin, or fatalities filtering.`
    : isGlobalQuery
      ? (localNote ? `${localNote} ` : '') + 'Showing bundled global political-violence totals by country.'
      : localNote;

  return {
    ...result,
    source: 'local-xlsx',
    attribution: ATTRIBUTION,
    dataNote: noteWithFilterWarning,
  };
}

/**
 * GET /api/acled/events
 *
 * Query params:
 *   country        (required) Full ACLED country name, e.g. "Ukraine"
 *   start_date     (required) ISO date "YYYY-MM-DD"
 *   end_date       (required) ISO date "YYYY-MM-DD"
 *   event_type     (optional) ACLED event type filter (live API only)
 *   actor          (optional) Actor name substring (live API only)
 *   admin1         (optional) Admin1 region filter (live API only)
 *   fatalities_min (optional) Minimum fatalities (integer, live API only)
 */
router.get('/acled/events', async (req, res) => {
  const { country = '', start_date, end_date, event_type, actor, admin1, fatalities_min } =
    req.query;

  if (!start_date || !end_date) {
    return res
      .status(400)
      .json({ error: 'Both "start_date" and "end_date" are required (YYYY-MM-DD).' });
  }
  if (!DATE_RE.test(start_date) || !DATE_RE.test(end_date)) {
    return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format.' });
  }

  // ── Branch: local xlsx data ───────────────────────────────────────────────
  if (useLocalData()) {
    try {
      return res.json(buildLocalResponse(country || '', start_date, end_date, null, {
        event_type,
        actor,
        admin1,
        fatalities_min,
      }));
    } catch (err) {
      console.error('[/api/acled/events] Local data error:', err.message);
      return res.status(500).json({
        error: `Failed to read local ACLED data: ${err.message}`,
        events: [],
        total: 0,
        aggregates: { timeline: [], typeBreakdown: [], topActors: [] },
      });
    }
  }

  // ── Branch: no API key AND no local data ──────────────────────────────────
  if (!hasApiKey) {
    return res.status(503).json({
      error:
        'ACLED is not configured. Set ACLED_API_KEY + ACLED_EMAIL in .env, ' +
        'or place the xlsx exports in server/data/.',
      events: [],
      total: 0,
      aggregates: { timeline: [], typeBreakdown: [], topActors: [] },
    });
  }

  // ── Branch: live ACLED API ────────────────────────────────────────────────
  try {
    const { events, total, cached } = await fetchAcledEvents({
      country: country.trim(),
      start_date,
      end_date,
      event_type: event_type || '',
      actor: actor || '',
      admin1: admin1 || '',
      fatalities_min: fatalities_min ? parseInt(fatalities_min, 10) : undefined,
    });

    const aggregates = computeAggregates(events);
    return res.json({ events, total, cached, aggregates, source: 'live-api', attribution: ATTRIBUTION });
  } catch (err) {
    console.error('[/api/acled/events] Live API error:', err.message);

    if (_localAvailable !== false && isLocalDataAvailable()) {
      try {
        return res.json(buildLocalResponse(country || '', start_date, end_date, err.message, {
          event_type,
          actor,
          admin1,
          fatalities_min,
        }));
      } catch (localErr) {
        console.error('[/api/acled/events] Local fallback error:', localErr.message);
      }
    }

    if (err.message.includes('401') || err.message.includes('bad request/auth')) {
      return res.status(401).json({
        error: 'ACLED authentication failed. Check your ACLED_API_KEY and ACLED_EMAIL.',
        events: [], total: 0, aggregates: { timeline: [], typeBreakdown: [], topActors: [] },
      });
    }
    if (err.message.includes('429') || err.message.includes('Rate limit')) {
      return res.status(429).json({
        error: 'ACLED rate limit reached. Please wait a few minutes and try again.',
        events: [], total: 0, aggregates: { timeline: [], typeBreakdown: [], topActors: [] },
      });
    }
    return res.status(500).json({
      error: 'Failed to fetch conflict data. Please try again.',
      events: [], total: 0, aggregates: { timeline: [], typeBreakdown: [], topActors: [] },
    });
  }
});

/**
 * GET /api/acled/types
 * Returns the list of ACLED event types for the filter UI.
 */
router.get('/acled/types', (_req, res) => {
  res.json({ types: getEventTypes() });
});

/**
 * GET /api/acled/countries
 * Returns sorted country list from local xlsx data (for FilterBar autocomplete).
 * Falls back to an empty array if local data is unavailable.
 */
router.get('/acled/countries', (_req, res) => {
  try {
    const countries = isLocalDataAvailable() ? getLocalCountries() : [];
    res.json({ countries, source: hasApiKey ? 'live-api' : 'local-xlsx' });
  } catch (err) {
    console.error('[/api/acled/countries]', err.message);
    res.json({ countries: [] });
  }
});

export default router;
