/**
 * News API Routes
 *
 * GET /api/news — Proxy to NewsAPI for immediate article display.
 *
 * Query params:
 *   country  (required) — ISO-2 code, e.g. "ca"
 *   category (optional) — NewsAPI category filter
 *   q        (optional) — Keyword search
 *   hours    (optional) — Time window, default 72
 */
import { Router } from 'express';
import { fetchCountryNews } from '../services/newsService.js';

const router = Router();

router.get('/news', async (req, res) => {
  const { country, category, q, hours } = req.query;

  if (!country || typeof country !== 'string' || country.length !== 2) {
    return res.status(400).json({
      error: 'Missing or invalid "country" query param. Must be a 2-letter ISO code.',
    });
  }

  try {
    // countryName is optional for the everything fallback — we derive it from the code
    // For simplicity, pass the code as the name too; the fallback will use it as a search term
    const countryName = req.query.countryName || country;

    const result = await fetchCountryNews(country, countryName, {
      pageSize: 20,
      category: category || undefined,
      q: q || undefined,
      hours: hours ? parseInt(hours, 10) : 72,
    });

    if (result.error && result.articles.length === 0) {
      return res.status(502).json({ error: result.error, articles: [] });
    }

    return res.json({
      articles: result.articles,
      totalResults: result.totalResults,
      source: result.source,
    });
  } catch (err) {
    console.error('[/api/news] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error fetching news.' });
  }
});

export default router;
