/**
 * Events Route — GDELT country news proxy
 *
 * GET /api/events
 *   country     (required) — ISO-2 code, e.g. "us"
 *   countryName (optional) — full name for GDELT query, e.g. "United States"
 *   dateRange   (optional) — "24h" | "3d" | "7d" | "14d" | "30d"  (default: "7d")
 *   tone        (optional) — "all" | "positive" | "neutral" | "negative"
 *   eventType   (optional) — "all" | "Politics" | "Military" | "Economy" | ...
 */
import { Router } from 'express';
import { fetchCountryEvents } from '../services/gdeltService.js';
import { fetchCountryLeagueTable } from '../services/sportsTableService.js';
import { fetchGlobalMarketSnapshot, fetchGlobalMarketHistory } from '../services/marketService.js';

const router = Router();

router.get('/events', async (req, res) => {
  const { country, countryName, dateRange = '7d', tone = 'all', eventType = 'all' } = req.query;

  if (!country || typeof country !== 'string' || country.length !== 2) {
    return res.status(400).json({
      error: 'Missing or invalid "country" query param. Must be a 2-letter ISO code.',
    });
  }

  const resolvedName = countryName || country.toUpperCase();

  try {
    const result = await fetchCountryEvents(country, resolvedName, {
      dateRange,
      tone,
      eventType,
      maxRecords: 80,
    });

    if (result.error && result.articles.length === 0) {
      return res.status(502).json({ error: result.error, articles: [], toneSeries: [] });
    }

    return res.json({
      articles: result.articles,
      toneSeries: result.toneSeries,
      total: result.articles.length,
      source: 'gdelt',
      error: result.error || null,
    });
  } catch (err) {
    console.error('[/api/events] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error fetching events.' });
  }
});

router.get('/sports-table', async (req, res) => {
  const { country, countryName, slot = 'primary' } = req.query;

  if (!country || typeof country !== 'string' || country.length !== 2) {
    return res.status(400).json({
      error: 'Missing or invalid "country" query param. Must be a 2-letter ISO code.',
      table: [],
    });
  }

  try {
    const result = await fetchCountryLeagueTable(country, countryName || country.toUpperCase(), slot);
    return res.json(result);
  } catch (err) {
    console.error('[/api/sports-table] Error:', err.message);
    return res.status(500).json({
      error: 'Internal server error fetching sports table.',
      table: [],
      league: null,
      season: null,
      isFallbackSeason: false,
    });
  }
});

router.get('/markets/global', async (_req, res) => {
  try {
    const result = await fetchGlobalMarketSnapshot();
    return res.json(result);
  } catch (err) {
    console.error('[/api/markets/global] Error:', err.message);
    return res.status(500).json({
      error: 'Internal server error fetching market snapshot.',
      source: 'none',
      lastUpdated: new Date().toISOString(),
      quotes: [],
    });
  }
});

router.get('/markets/global-history', async (_req, res) => {
  try {
    const result = await fetchGlobalMarketHistory();
    return res.json(result);
  } catch (err) {
    console.error('[/api/markets/global-history] Error:', err.message);
    return res.status(500).json({
      error: 'Internal server error fetching market history.',
      source: 'none',
      lastUpdated: new Date().toISOString(),
      seriesBySymbol: {},
      symbols: [],
    });
  }
});

export default router;
