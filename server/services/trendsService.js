import https from 'https';

const GOOGLE_TRENDS_DAILY_RSS  = 'https://trends.google.com/trendingsearches/daily/rss';
const WIKIPEDIA_PAGEVIEWS_API  = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access';
const REDDIT_BASE              = 'www.reddit.com';
const REQUEST_TIMEOUT          = 10_000;
const CACHE_TTL_MS             = 10 * 60 * 1000; // 10 minutes

const TREND_REGIONS = ['US', 'GB', 'IN', 'CA', 'AU', 'DE', 'JP', 'BR', 'ZA'];

// ─── Static fallbacks (used when live sources fail) ───────────

const FALLBACK_NEWS = [
  { topic: 'AI regulation', score: 96, mentions: 4, regions: ['US', 'GB', 'CA'] },
  { topic: 'Inflation outlook', score: 91, mentions: 3, regions: ['US', 'DE', 'BR'] },
  { topic: 'Energy prices', score: 88, mentions: 3, regions: ['DE', 'JP', 'IN'] },
  { topic: 'Election updates', score: 85, mentions: 3, regions: ['US', 'IN', 'ZA'] },
  { topic: 'Semiconductor demand', score: 81, mentions: 2, regions: ['US', 'JP'] },
  { topic: 'Climate events', score: 78, mentions: 3, regions: ['AU', 'BR', 'ZA'] },
  { topic: 'Global shipping', score: 74, mentions: 2, regions: ['IN', 'GB'] },
  { topic: 'Labor strikes', score: 70, mentions: 2, regions: ['GB', 'CA'] },
];

const FALLBACK_POP = [
  { topic: 'Grammy Awards 2025', score: 95, subreddit: 'r/Music', rank: 1 },
  { topic: 'Severance Season 2', score: 90, subreddit: 'r/television', rank: 2 },
  { topic: 'Super Bowl halftime show', score: 86, subreddit: 'r/NFL', rank: 3 },
  { topic: 'Minecraft Movie trailer', score: 82, subreddit: 'r/movies', rank: 4 },
  { topic: 'Kendrick Lamar Tour', score: 78, subreddit: 'r/hiphopheads', rank: 5 },
  { topic: 'GTA VI release date', score: 74, subreddit: 'r/gaming', rank: 6 },
  { topic: 'The White Lotus Season 3', score: 70, subreddit: 'r/television', rank: 7 },
  { topic: 'Taylor Swift Eras Tour film', score: 66, subreddit: 'r/Music', rank: 8 },
];

const FALLBACK_WIKI = [
  { topic: 'Oscars 2025', views: 1800000, rank: 1 },
  { topic: 'Super Bowl LIX', views: 1500000, rank: 2 },
  { topic: 'ChatGPT', views: 1200000, rank: 3 },
  { topic: 'Dune: Part Two', views: 1050000, rank: 4 },
  { topic: 'FIFA World Cup 2026', views: 980000, rank: 5 },
  { topic: 'SpaceX Starship', views: 870000, rank: 6 },
  { topic: 'Taylor Swift', views: 810000, rank: 7 },
  { topic: 'Artificial intelligence', views: 760000, rank: 8 },
];

// ─── Cache ────────────────────────────────────────────────────

let _cache = null;

// ─── Public API ───────────────────────────────────────────────

export async function fetchGlobalTrends() {
  if (_cache && _cache.expiresAt > Date.now()) return _cache.payload;

  const [newsRes, wikiRes, redditRes] = await Promise.allSettled([
    fetchNewsTrends(),
    fetchWikipediaTrending(),
    fetchRedditTrending(),
  ]);

  const news      = newsRes.status   === 'fulfilled' && newsRes.value.length   > 0 ? newsRes.value   : FALLBACK_NEWS;
  const wikipedia = wikiRes.status   === 'fulfilled' && wikiRes.value.length   > 0 ? wikiRes.value   : FALLBACK_WIKI;
  const popCulture = redditRes.status === 'fulfilled' && redditRes.value.length > 0 ? redditRes.value : FALLBACK_POP;

  const payload = {
    source: 'mixed',
    lastUpdated: new Date().toISOString(),
    regionsQueried: TREND_REGIONS,
    trends: news,        // news/global trends (Google RSS or fallback)
    popCulture,          // Reddit popular
    wikipedia,           // Wikipedia most-viewed
    error: null,
  };

  _cache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
  return payload;
}

// ─── News trends (Google Trends RSS) ─────────────────────────

async function fetchNewsTrends() {
  const settled = await Promise.allSettled(
    TREND_REGIONS.map((geo) => fetchRegionTrendingRss(geo))
  );

  const successes = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (successes.length === 0) throw new Error('No regional feeds available');

  const topicMap = new Map();
  for (const regionFeed of successes) {
    for (const trend of regionFeed.trends) {
      const key = normalizeKey(trend.topic);
      if (!key) continue;
      const existing = topicMap.get(key) || { topic: trend.topic, score: 0, mentions: 0, regions: new Set() };
      existing.score += trend.score;
      existing.mentions += 1;
      existing.regions.add(regionFeed.region);
      topicMap.set(key, existing);
    }
  }

  return [...topicMap.values()]
    .map((t) => ({ topic: t.topic, score: Math.round(t.score), mentions: t.mentions, regions: [...t.regions] }))
    .sort((a, b) => b.score - a.score || b.mentions - a.mentions)
    .slice(0, 10);
}

async function fetchRegionTrendingRss(region) {
  const url = `${GOOGLE_TRENDS_DAILY_RSS}?geo=${encodeURIComponent(region)}`;
  const xml = await httpGetText(url, REQUEST_TIMEOUT, {
    'User-Agent': 'Mozilla/5.0 (compatible; GlobeProject/1.0)',
    'Accept': 'application/rss+xml,application/xml,text/xml,*/*',
  });
  const trends = parseDailyRss(xml);
  return { region, trends: trends.slice(0, 12) };
}

// ─── Wikipedia most-viewed ────────────────────────────────────

// Pages to exclude from Wikipedia results
const WIKI_SKIP = /^(Main_Page|Wikipedia:|Help:|Special:|Portal:|Talk:|File:|Template:|Deaths_in_|List_of|Lists_of|Index_of)/i;

async function fetchWikipediaTrending() {
  // Yesterday's data is always complete; today's may not be finalized yet
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');

  const url = `${WIKIPEDIA_PAGEVIEWS_API}/${year}/${month}/${day}`;
  const json = await httpGetJson(url, REQUEST_TIMEOUT, {
    'User-Agent': 'GlobeProject/1.0 (educational project)',
    'Accept': 'application/json',
  });

  const articles = json?.items?.[0]?.articles || [];
  return articles
    .filter((a) => !WIKI_SKIP.test(a.article))
    .slice(0, 12)
    .map((a) => ({
      topic: a.article.replace(/_/g, ' '),
      views: a.views,
      rank:  a.rank,
      url:   `https://en.wikipedia.org/wiki/${a.article}`,
    }));
}

// ─── Reddit popular posts ─────────────────────────────────────

async function fetchRedditTrending() {
  const json = await httpGetJson(
    '/r/popular/hot.json?limit=30&raw_json=1',
    REQUEST_TIMEOUT,
    {
      'User-Agent': 'GlobeProject/1.0 (educational project; Node.js)',
      'Accept': 'application/json',
    },
    REDDIT_BASE
  );

  const children = json?.data?.children || [];
  return children
    .filter((p) => !p.data.over_18)
    .slice(0, 12)
    .map((p, i) => {
      const title = p.data.title || '';
      return {
        topic:     title.length > 72 ? `${title.slice(0, 69)}…` : title,
        subreddit: p.data.subreddit_name_prefixed || 'r/popular',
        score:     p.data.score,
        rank:      i + 1,
        url:       p.data.permalink ? `https://www.reddit.com${p.data.permalink}` : null,
      };
    });
}

// ─── HTTP helpers ─────────────────────────────────────────────

function httpGetText(url, timeoutMs, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        path:     `${u.pathname}${u.search}`,
        method:   'GET',
        family:   4,
        headers,
      },
      (res) => {
        // Follow single redirect
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          httpGetText(res.headers.location, timeoutMs, headers).then(resolve).catch(reject);
          return;
        }
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

function httpGetJson(pathOrUrl, timeoutMs, headers = {}, hostname = null) {
  return new Promise((resolve, reject) => {
    let opts;
    if (hostname) {
      opts = { hostname, path: pathOrUrl, method: 'GET', family: 4, headers };
    } else {
      const u = new URL(pathOrUrl);
      opts = { protocol: u.protocol, hostname: u.hostname, path: `${u.pathname}${u.search}`, method: 'GET', family: 4, headers };
    }

    const req = https.request(opts, (res) => {
      // Follow single redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        httpGetJson(res.headers.location, timeoutMs, headers, null).then(resolve).catch(reject);
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(body)); } catch { reject(new Error('JSON parse error')); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

// ─── RSS parser ───────────────────────────────────────────────

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
    if (topic) items.push({ topic, score: scoreFromTraffic(rawTraffic || '') });
  }
  return items;
}

function scoreFromTraffic(raw) {
  const text = String(raw).replace(/[,\s+]/g, '').toUpperCase();
  const n = Number(text.replace(/[KM]/g, ''));
  if (!Number.isFinite(n)) return 8;
  if (text.endsWith('M')) return Math.max(10, Math.round(n * 12));
  if (text.endsWith('K')) return Math.max(8, Math.round(n / 12));
  return Math.max(6, Math.round(n / 25000));
}

function normalizeKey(text) {
  return String(text || '').toLowerCase().replace(/&amp;/g, 'and').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeXml(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function pickFirst(text, regexes) {
  for (const re of regexes) {
    const m = re.exec(text);
    if (m?.[1]) return m[1];
  }
  return '';
}
