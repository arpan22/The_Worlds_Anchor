import https from 'https';

const STOOQ_QUOTE_URL = 'https://stooq.com/q/l/';
const STOOQ_HIST_URL  = 'https://stooq.com/q/d/l/';
const CACHE_TTL_MS       = 2 * 60 * 1000;  // 2 minutes
const STALE_TTL_MS       = 30 * 60 * 1000; // serve stale data up to 30 min on error
const REQUEST_TIMEOUT    = 12_000;
const BATCH_SIZE         = 3;              // requests per batch to avoid connection refusals
const BATCH_DELAY_MS     = 300;            // ms between batches

const SYMBOLS = [
  { stooq: '^spx',   name: 'S&P 500',    region: 'United States' },
  { stooq: '^dji',   name: 'Dow Jones',  region: 'United States' },
  { stooq: '^ndq',   name: 'NASDAQ',     region: 'United States' },
  { stooq: '^ukx',   name: 'FTSE 100',   region: 'United Kingdom' },
  { stooq: '^dax',   name: 'DAX',        region: 'Germany' },
  { stooq: '^cac',   name: 'CAC 40',     region: 'France' },
  { stooq: '^nkx',   name: 'Nikkei 225', region: 'Japan' },
  { stooq: '^hsi',   name: 'Hang Seng',  region: 'Hong Kong' },
  { stooq: '^ibex',  name: 'IBEX 35',    region: 'Spain' },
  { stooq: '^kospi', name: 'KOSPI',      region: 'South Korea' },
];

// Use the Stooq symbol as the public key so the rest of the code has one ID.
const asPublicSymbol = (stooq) => stooq.toUpperCase();

let _snapshotCache     = null;
let _historyCache      = null;
let _lastGoodSnapshot  = null; // stale fallback — survives errors
let _lastGoodHistory   = null;

// ─── Public API (same signatures as before) ───────────────────

export async function fetchGlobalMarketSnapshot() {
  if (_snapshotCache && _snapshotCache.expiresAt > Date.now()) {
    return _snapshotCache.payload;
  }

  try {
    const settled = await fetchInBatches(SYMBOLS, BATCH_SIZE, fetchStooqQuote, BATCH_DELAY_MS);

    const quotes = settled
      .map((r, i) => {
        if (r.status !== 'fulfilled') return null;
        const row  = r.value;
        const meta = SYMBOLS[i];
        return {
          symbol:        asPublicSymbol(meta.stooq),
          name:          meta.name,
          region:        meta.region,
          price:         row.close,
          change:        row.change,
          changePercent: row.changePercent,
          currency:      'USD',
          marketTime:    row.date ? `${row.date}T${row.time || '00:00:00'}Z` : null,
        };
      })
      .filter((q) => q && q.price > 0);

    if (quotes.length === 0) throw new Error('All symbol fetches failed');

    const payload = {
      source: 'stooq',
      lastUpdated: new Date().toISOString(),
      quotes,
      error: null,
    };

    _snapshotCache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
    _lastGoodSnapshot = payload;
    return payload;
  } catch (err) {
    // Serve stale data if available rather than an error
    if (_lastGoodSnapshot) {
      return { ..._lastGoodSnapshot, stale: true };
    }
    const payload = {
      source: 'error',
      lastUpdated: new Date().toISOString(),
      quotes: [],
      error: `Market data unavailable: ${err.message}`,
    };
    _snapshotCache = { payload, expiresAt: Date.now() + 15_000 };
    return payload;
  }
}

export async function fetchGlobalMarketHistory() {
  if (_historyCache && _historyCache.expiresAt > Date.now()) {
    return _historyCache.payload;
  }

  try {
    const results = await fetchInBatches(
      SYMBOLS.map(({ stooq }) => stooq),
      BATCH_SIZE,
      (stooq) => fetchStooqHistory(stooq, 10),
      BATCH_DELAY_MS
    );

    const seriesBySymbol = {};
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const sym = asPublicSymbol(SYMBOLS[i].stooq);
      if (r.status === 'fulfilled' && r.value.length > 0) {
        seriesBySymbol[sym] = r.value;
      }
    }

    if (Object.keys(seriesBySymbol).length === 0) throw new Error('All history fetches failed');

    const payload = {
      source: 'stooq',
      lastUpdated: new Date().toISOString(),
      seriesBySymbol,
      symbols: SYMBOLS.map((m) => ({ ...m, symbol: asPublicSymbol(m.stooq) })),
      error: null,
    };

    _historyCache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
    _lastGoodHistory = payload;
    return payload;
  } catch (err) {
    if (_lastGoodHistory) {
      return { ..._lastGoodHistory, stale: true };
    }
    const payload = {
      source: 'error',
      lastUpdated: new Date().toISOString(),
      seriesBySymbol: {},
      symbols: [],
      error: `History unavailable: ${err.message}`,
    };
    _historyCache = { payload, expiresAt: Date.now() + 15_000 };
    return payload;
  }
}

// ─── Batch fetcher — avoids simultaneous connection bursts ────

async function fetchInBatches(items, batchSize, fn, delayMs) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

// ─── Stooq helpers ────────────────────────────────────────────

async function fetchStooqQuote(meta) {
  // Fetch last 5 trading days so we always have a prev-close even over weekends.
  const d2 = stooqDate(new Date());
  const d1 = stooqDate(daysAgo(14));

  const url = `${STOOQ_HIST_URL}?s=${encodeURIComponent(meta.stooq)}&d1=${d1}&d2=${d2}&i=d&f=sd2t2ohlcv&h&e=csv`;
  const csv = await httpGetText(url, REQUEST_TIMEOUT);
  const rows = parseCsv(csv);

  if (rows.length === 0) return { close: 0, change: 0, changePercent: 0, date: null, time: null };

  const last = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;

  const close = toNum(last.Close ?? last.close);
  const prevClose = prev ? toNum(prev.Close ?? prev.close) : toNum(last.Open ?? last.open);
  const change = prevClose > 0 ? close - prevClose : 0;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    close,
    change,
    changePercent,
    date: last.Date ?? last.date ?? null,
    time: last.Time ?? last.time ?? null,
  };
}

async function fetchStooqHistory(stooqSymbol, days = 10) {
  const d2 = stooqDate(new Date());
  const d1 = stooqDate(daysAgo(days * 2)); // fetch extra to ensure enough trading days

  const url = `${STOOQ_HIST_URL}?s=${encodeURIComponent(stooqSymbol)}&d1=${d1}&d2=${d2}&i=d&f=sd2t2ohlcv&h&e=csv`;
  const csv = await httpGetText(url, REQUEST_TIMEOUT);
  const rows = parseCsv(csv);

  return rows
    .slice(-days)
    .map((r) => ({
      time:  r.Date ?? r.date ?? '',
      price: toNum(r.Close ?? r.close),
    }))
    .filter((p) => p.price > 0);
}

// ─── Utilities ────────────────────────────────────────────────

function stooqDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseCsv(text) {
  const lines = String(text || '').trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  }).filter((r) => {
    // Skip rows where date is missing or Close is not a number
    const close = toNum(r.Close ?? r.close, NaN);
    return (r.Date || r.date) && Number.isFinite(close);
  });
}

function httpGetText(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname:  u.hostname,
        path:      `${u.pathname}${u.search}`,
        method:    'GET',
        family:    4,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NewsGlobe/1.0)',
          'Accept':     'text/csv,text/plain,*/*',
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}`));
          } else {
            resolve(body);
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}
