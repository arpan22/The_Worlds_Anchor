import https from 'https';

const GOOGLE_TRENDS_DAILY_RSS = 'https://trends.google.com/trendingsearches/daily/rss';
const REQUEST_TIMEOUT = 10_000;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const TREND_REGIONS = ['US', 'GB', 'IN', 'CA', 'AU', 'DE', 'JP', 'BR', 'ZA'];

const FALLBACK_TOPICS = [
  { topic: 'AI regulation', score: 96, mentions: 4, regions: ['US', 'GB', 'CA'] },
  { topic: 'Inflation outlook', score: 91, mentions: 3, regions: ['US', 'DE', 'BR'] },
  { topic: 'Energy prices', score: 88, mentions: 3, regions: ['DE', 'JP', 'IN'] },
  { topic: 'Election updates', score: 85, mentions: 3, regions: ['US', 'IN', 'ZA'] },
  { topic: 'Semiconductor demand', score: 81, mentions: 2, regions: ['US', 'JP'] },
  { topic: 'Climate events', score: 78, mentions: 3, regions: ['AU', 'BR', 'ZA'] },
  { topic: 'Global shipping', score: 74, mentions: 2, regions: ['IN', 'GB'] },
  { topic: 'Labor strikes', score: 70, mentions: 2, regions: ['GB', 'CA'] },
];

let _cache = null;

export async function fetchGlobalTrends() {
  if (_cache && _cache.expiresAt > Date.now()) {
    return _cache.payload;
  }

  try {
    const settled = await Promise.allSettled(
      TREND_REGIONS.map((geo) => fetchRegionTrendingRss(geo))
    );

    const successes = settled
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);

    if (successes.length === 0) {
      throw new Error('No regional trend feeds available.');
    }

    const topicMap = new Map();
    for (const regionFeed of successes) {
      for (const trend of regionFeed.trends) {
        const key = normalizeKey(trend.topic);
        if (!key) continue;

        const existing = topicMap.get(key) || {
          topic: trend.topic,
          score: 0,
          mentions: 0,
          regions: new Set(),
        };

        existing.score += trend.score;
        existing.mentions += 1;
        existing.regions.add(regionFeed.region);
        topicMap.set(key, existing);
      }
    }

    const trends = [...topicMap.values()]
      .map((t) => ({
        topic: t.topic,
        score: Math.round(t.score),
        mentions: t.mentions,
        regions: [...t.regions],
      }))
      .sort((a, b) => b.score - a.score || b.mentions - a.mentions)
      .slice(0, 10);

    const payload = {
      source: 'google-trends-rss',
      lastUpdated: new Date().toISOString(),
      regionsQueried: TREND_REGIONS,
      trends,
      error: null,
    };

    _cache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
    return payload;
  } catch (err) {
    const payload = {
      source: 'fallback',
      lastUpdated: new Date().toISOString(),
      regionsQueried: TREND_REGIONS,
      trends: FALLBACK_TOPICS,
      error: `Trends feed unavailable: ${err.message}`,
    };
    _cache = { payload, expiresAt: Date.now() + 60_000 };
    return payload;
  }
}

async function fetchRegionTrendingRss(region) {
  const url = `${GOOGLE_TRENDS_DAILY_RSS}?geo=${encodeURIComponent(region)}`;
  const xml = await httpGetText(url, REQUEST_TIMEOUT);
  const trends = parseDailyRss(xml);
  return { region, trends: trends.slice(0, 12) };
}

function parseDailyRss(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const rawTitle = pickFirst(block, [
      /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i,
      /<title>([\s\S]*?)<\/title>/i,
    ]);

    const rawTraffic = pickFirst(block, [
      /<ht:approx_traffic><!\[CDATA\[([\s\S]*?)\]\]><\/ht:approx_traffic>/i,
      /<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i,
    ]);

    const topic = decodeXml(rawTitle || '').trim();
    if (!topic) continue;

    items.push({
      topic,
      score: scoreFromTraffic(rawTraffic || ''),
    });
  }

  return items;
}

function scoreFromTraffic(raw) {
  // Examples: "200K+", "1M+", "50,000+"
  const text = String(raw).replace(/[,\s+]/g, '').toUpperCase();
  const n = Number(text.replace(/[KM]/g, ''));
  if (!Number.isFinite(n)) return 8;
  if (text.endsWith('M')) return Math.max(10, Math.round(n * 12));
  if (text.endsWith('K')) return Math.max(8, Math.round(n / 12));
  return Math.max(6, Math.round(n / 25000));
}

function normalizeKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeXml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pickFirst(text, regexes) {
  for (const re of regexes) {
    const m = re.exec(text);
    if (m?.[1]) return m[1];
  }
  return '';
}

function httpGetText(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        family: 4,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GlobeProject/1.0)',
          Accept: 'application/rss+xml,application/xml,text/xml,*/*',
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          resolve(body);
        });
      }
    );

    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}
