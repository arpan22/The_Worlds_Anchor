import https from 'https';
import { config } from '../config/index.js';

const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FMP_QUOTE_URL = 'https://financialmodelingprep.com/api/v3/quote';
const LIVEINDEX_URL = 'https://liveindex.org/';
const CACHE_TTL_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

const SYMBOLS = [
  { symbol: '^GSPC', name: 'S&P 500', region: 'United States' },
  { symbol: '^DJI', name: 'Dow Jones', region: 'United States' },
  { symbol: '^IXIC', name: 'NASDAQ', region: 'United States' },
  { symbol: '^FTSE', name: 'FTSE 100', region: 'United Kingdom' },
  { symbol: '^GDAXI', name: 'DAX', region: 'Germany' },
  { symbol: '^FCHI', name: 'CAC 40', region: 'France' },
  { symbol: '^N225', name: 'Nikkei 225', region: 'Japan' },
  { symbol: '^HSI', name: 'Hang Seng', region: 'Hong Kong' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50', region: 'Europe' },
  { symbol: '^AXJO', name: 'ASX 200', region: 'Australia' },
];

const FMP_SYMBOL_MAP = {
  '^GSPC': '^GSPC',
  '^DJI': '^DJI',
  '^IXIC': '^IXIC',
  '^FTSE': '^FTSE',
  '^GDAXI': '^GDAXI',
  '^FCHI': '^FCHI',
  '^N225': '^N225',
  '^HSI': '^HSI',
  '^STOXX50E': '^STOXX50E',
  '^AXJO': '^AXJO',
};

const FALLBACK_QUOTES = [
  { symbol: '^GSPC', name: 'S&P 500', region: 'United States', price: 0, change: 0, changePercent: 0, currency: 'USD' },
  { symbol: '^DJI', name: 'Dow Jones', region: 'United States', price: 0, change: 0, changePercent: 0, currency: 'USD' },
  { symbol: '^IXIC', name: 'NASDAQ', region: 'United States', price: 0, change: 0, changePercent: 0, currency: 'USD' },
  { symbol: '^FTSE', name: 'FTSE 100', region: 'United Kingdom', price: 0, change: 0, changePercent: 0, currency: 'GBP' },
  { symbol: '^GDAXI', name: 'DAX', region: 'Germany', price: 0, change: 0, changePercent: 0, currency: 'EUR' },
  { symbol: '^N225', name: 'Nikkei 225', region: 'Japan', price: 0, change: 0, changePercent: 0, currency: 'JPY' },
];

let _cache = null;
let _historyCache = null;

export async function fetchGlobalMarketSnapshot() {
  if (_cache && _cache.expiresAt > Date.now()) {
    return _cache.payload;
  }

  try {
    const yahoo = await tryYahooProvider();
    if (yahoo) {
      _cache = { payload: yahoo, expiresAt: Date.now() + CACHE_TTL_MS };
      return yahoo;
    }

    const fmp = await tryFmpProvider();
    if (fmp) {
      _cache = { payload: fmp, expiresAt: Date.now() + CACHE_TTL_MS };
      return fmp;
    }

    const liveIndex = await tryLiveIndexProvider();
    if (liveIndex) {
      _cache = { payload: liveIndex, expiresAt: Date.now() + CACHE_TTL_MS };
      return liveIndex;
    }

    throw new Error('all providers unavailable');
  } catch (err) {
    const payload = {
      source: 'fallback',
      lastUpdated: new Date().toISOString(),
      quotes: FALLBACK_QUOTES,
      error: `Live market feed unavailable (${formatError(err)}). Showing fallback watchlist.`,
    };
    _cache = { payload, expiresAt: Date.now() + 30_000 };
    return payload;
  }
}

export async function fetchGlobalMarketHistory() {
  if (_historyCache && _historyCache.expiresAt > Date.now()) {
    return _historyCache.payload;
  }

  try {
    const histories = await Promise.allSettled(
      SYMBOLS.map(async (meta) => {
        const series = await fetchYahooSeries(meta.symbol, '1d', '15m');
        return { symbol: meta.symbol, name: meta.name, region: meta.region, series };
      })
    );

    const seriesBySymbol = {};
    let successCount = 0;
    for (const item of histories) {
      if (item.status !== 'fulfilled') continue;
      const series = Array.isArray(item.value?.series) ? item.value.series : [];
      if (series.length === 0) continue;
      seriesBySymbol[item.value.symbol] = series;
      successCount += 1;
    }

    if (successCount === 0) {
      throw new Error('no intraday series available');
    }

    // Fill missing symbols from current snapshot so one failed symbol doesn't
    // collapse the whole chart into fallback mode.
    if (successCount < SYMBOLS.length) {
      const snapshot = await fetchGlobalMarketSnapshot();
      const now = new Date();
      const start = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      for (const q of snapshot.quotes || []) {
        if (seriesBySymbol[q.symbol]) continue;
        const currentPrice = toNumber(q.price, 0);
        const absChange = toNumber(q.change, 0);
        const baseline = currentPrice - absChange;
        seriesBySymbol[q.symbol] = [
          { time: start.toISOString(), price: baseline },
          { time: now.toISOString(), price: currentPrice },
        ];
      }
    }

    const payload = {
      source: 'yahoo-chart',
      lastUpdated: new Date().toISOString(),
      seriesBySymbol,
      symbols: SYMBOLS,
      error: successCount < SYMBOLS.length
        ? 'Some indices use derived fallback points because intraday history was unavailable.'
        : null,
    };

    _historyCache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
    return payload;
  } catch (err) {
    const snapshot = await fetchGlobalMarketSnapshot();
    const now = new Date();
    const start = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const seriesBySymbol = {};

    for (const q of snapshot.quotes || []) {
      const currentPrice = toNumber(q.price, 0);
      const absChange = toNumber(q.change, 0);
      const baseline = currentPrice - absChange;
      seriesBySymbol[q.symbol] = [
        { time: start.toISOString(), price: baseline },
        { time: now.toISOString(), price: currentPrice },
      ];
    }

    const payload = {
      source: 'snapshot-derived',
      lastUpdated: new Date().toISOString(),
      seriesBySymbol,
      symbols: SYMBOLS,
      error: `Historical feed unavailable (${formatError(err)}). Using 24h derived baseline.`,
    };
    _historyCache = { payload, expiresAt: Date.now() + 60_000 };
    return payload;
  }
}

async function tryLiveIndexProvider() {
  try {
    const { statusCode, body } = await httpGet(LIVEINDEX_URL, REQUEST_TIMEOUT_MS, {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'News-Globe/1.0 (+https://localhost)',
    });
    if (statusCode < 200 || statusCode >= 300) return null;

    const parsedRows = extractRowsFromHtmlTable(body);
    if (parsedRows.length === 0) return null;

    const aliasMap = new Map([
      ['s&p 500', '^GSPC'],
      ['dow jones', '^DJI'],
      ['nasdaq', '^IXIC'],
      ['ftse 100', '^FTSE'],
      ['dax', '^GDAXI'],
      ['cac 40', '^FCHI'],
      ['nikkei 225', '^N225'],
      ['hang seng', '^HSI'],
      ['euro stoxx 50', '^STOXX50E'],
      ['asx 200', '^AXJO'],
    ]);

    const rowsBySymbol = new Map();
    for (const row of parsedRows) {
      const name = String(row.name || '').toLowerCase();
      let symbol = null;
      for (const [key, mapped] of aliasMap.entries()) {
        if (name.includes(key)) {
          symbol = mapped;
          break;
        }
      }
      if (!symbol) continue;
      rowsBySymbol.set(symbol, row);
    }

    const quotes = SYMBOLS.map((meta) => {
      const row = rowsBySymbol.get(meta.symbol);
      return {
        symbol: meta.symbol,
        name: meta.name,
        region: meta.region,
        price: row ? toNumber(row.price, 0) : 0,
        change: row ? toNumber(row.change, 0) : 0,
        changePercent: row ? toNumber(row.changePercent, 0) : 0,
        currency: 'USD',
        marketTime: null,
      };
    });

    const hasNonZero = quotes.some((q) => Number(q.price) > 0);
    if (!hasNonZero) return null;
    if (!quotesPassSanityChecks(quotes)) return null;

    return {
      source: 'liveindex',
      lastUpdated: new Date().toISOString(),
      quotes,
      error: null,
    };
  } catch {
    return null;
  }
}

async function tryYahooProvider() {
  try {
    const params = new URLSearchParams({ symbols: SYMBOLS.map((s) => s.symbol).join(',') });
    const data = await httpGetJson(`${YAHOO_QUOTE_URL}?${params}`);
    const results = Array.isArray(data?.quoteResponse?.result) ? data.quoteResponse.result : [];
    if (results.length === 0) return null;

    const bySymbol = new Map(results.map((item) => [String(item?.symbol || ''), item]));
    const quotes = SYMBOLS.map((meta) => {
      const q = bySymbol.get(meta.symbol) || {};
      return {
        symbol: meta.symbol,
        name: meta.name,
        region: meta.region,
        price: toNumber(q.regularMarketPrice),
        change: toNumber(q.regularMarketChange),
        changePercent: toNumber(q.regularMarketChangePercent),
        currency: q.currency || 'USD',
        marketTime: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : null,
      };
    });

    if (!quotesPassSanityChecks(quotes)) return null;

    return {
      source: 'yahoo',
      lastUpdated: new Date().toISOString(),
      quotes,
      error: null,
    };
  } catch {
    return null;
  }
}

async function tryFmpProvider() {
  try {
    const mappedSymbols = SYMBOLS.map((s) => FMP_SYMBOL_MAP[s.symbol]).filter(Boolean);
    const params = new URLSearchParams({
      apikey: config.fmpApiKey || 'demo',
    });
    const symbolPath = mappedSymbols.map((s) => encodeURIComponent(s)).join(',');
    const url = `${FMP_QUOTE_URL}/${symbolPath}?${params}`;
    const data = await httpGetJson(url);
    const list = Array.isArray(data) ? data : [];
    if (list.length === 0) return null;

    const bySymbol = new Map(list.map((item) => [String(item?.symbol || ''), item]));
    const quotes = SYMBOLS.map((meta) => {
      const fmpSymbol = FMP_SYMBOL_MAP[meta.symbol];
      const q = bySymbol.get(fmpSymbol) || {};
      return {
        symbol: meta.symbol,
        name: meta.name,
        region: meta.region,
        price: toNumber(q.price),
        change: toNumber(q.change),
        changePercent: toNumber(q.changesPercentage),
        currency: 'USD',
        marketTime: q.timestamp ? new Date(q.timestamp * 1000).toISOString() : null,
      };
    });

    if (!quotesPassSanityChecks(quotes)) return null;

    return {
      source: 'fmp',
      lastUpdated: new Date().toISOString(),
      quotes,
      error: 'Primary live feed unavailable; using secondary provider.',
    };
  } catch {
    return null;
  }
}

async function fetchYahooSeries(symbol, range, interval) {
  const params = new URLSearchParams({
    range,
    interval,
    includePrePost: 'false',
    events: 'div,splits',
  });
  const data = await httpGetJson(`${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?${params}`);
  const result = data?.chart?.result?.[0];
  const stamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const closes = Array.isArray(result?.indicators?.quote?.[0]?.close)
    ? result.indicators.quote[0].close
    : [];

  const series = [];
  for (let i = 0; i < Math.min(stamps.length, closes.length); i += 1) {
    const ts = Number(stamps[i]);
    const price = Number(closes[i]);
    if (!Number.isFinite(ts) || !Number.isFinite(price)) continue;
    series.push({
      time: new Date(ts * 1000).toISOString(),
      price,
    });
  }
  return series;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function httpGetJson(url) {
  const { statusCode, body } = await httpGet(url, REQUEST_TIMEOUT_MS, {
    Accept: 'application/json',
    'User-Agent': 'News-Globe/1.0 (+https://localhost)',
  });

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`HTTP ${statusCode}`);
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error('invalid json');
  }
}

async function httpGet(url, timeoutMs, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        headers,
        family: 4,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
      }
    );

    req.setTimeout(timeoutMs, () => req.destroy(new Error('request timed out')));
    req.on('error', reject);
    req.end();
  });
}

function formatError(err) {
  if (!err) return 'network error';
  if (typeof err.message === 'string') return err.message;
  return 'network error';
}

function extractRowsFromHtmlTable(html) {
  const rows = [];
  const rowMatches = String(html || '').match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const rawRow of rowMatches) {
    const cells = [];
    const cellMatches = rawRow.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    for (const rawCell of cellMatches) {
      const clean = stripHtml(rawCell);
      if (clean) cells.push(clean);
    }
    // Expected shape: [Index Name, Last, Change, Change% ...]
    if (cells.length < 4) continue;
    const maybePrice = parseMarketNumber(cells[1]);
    if (!Number.isFinite(maybePrice)) continue;
    rows.push({
      name: cells[0],
      price: maybePrice,
      change: parseMarketNumber(cells[2]),
      changePercent: parseMarketNumber(cells[3]),
    });
  }
  return rows;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#37;/g, '%')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMarketNumber(value) {
  const cleaned = String(value || '')
    .replace(/[%+,]/g, '')
    .replace(/[^\d.\-]/g, '');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function quotesPassSanityChecks(quotes) {
  const minBySymbol = {
    '^GSPC': 1000,
    '^DJI': 5000,
    '^IXIC': 1000,
    '^FTSE': 1000,
    '^GDAXI': 1000,
    '^FCHI': 1000,
    '^N225': 1000,
    '^HSI': 1000,
    '^STOXX50E': 100,
    '^AXJO': 100,
  };
  for (const q of quotes || []) {
    const p = Number(q?.price);
    if (!Number.isFinite(p) || p <= 0) continue;
    const min = minBySymbol[q.symbol];
    if (Number.isFinite(min) && p < min) return false;
  }
  return true;
}
