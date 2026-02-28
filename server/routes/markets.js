import { Router } from 'express';
import { fetchGlobalMarketSnapshot, fetchGlobalMarketHistory } from '../services/marketService.js';

const router = Router();

// GET /api/markets/global — current snapshot
router.get('/markets/global', async (_req, res) => {
  try {
    const data = await fetchGlobalMarketSnapshot();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch market data.' });
  }
});

// GET /api/markets/global-history — intraday series
router.get('/markets/global-history', async (_req, res) => {
  try {
    const data = await fetchGlobalMarketHistory();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch market history.' });
  }
});

export default router;
