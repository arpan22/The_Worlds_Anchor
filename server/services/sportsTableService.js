import https from 'https';
import { config } from '../config/index.js';

const SPORTSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${config.sportsDbApiKey || '3'}`;
const CACHE_TTL_MS = 20 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

const _cache = new Map();

const FALLBACK_SNAPSHOTS = {
  gb: {
    league: { id: 'fallback-epl', name: 'Premier League', sport: 'Soccer', country: 'England' },
    season: '2024-2025',
    rows: [
      { position: 1, team: 'Manchester City', played: 38, win: 28, draw: 7, loss: 3, points: 91 },
      { position: 2, team: 'Arsenal', played: 38, win: 27, draw: 6, loss: 5, points: 87 },
      { position: 3, team: 'Liverpool', played: 38, win: 24, draw: 10, loss: 4, points: 82 },
      { position: 4, team: 'Aston Villa', played: 38, win: 21, draw: 8, loss: 9, points: 71 },
      { position: 5, team: 'Tottenham Hotspur', played: 38, win: 20, draw: 6, loss: 12, points: 66 },
      { position: 6, team: 'Chelsea', played: 38, win: 18, draw: 9, loss: 11, points: 63 },
    ],
  },
  us: {
    league: { id: 'fallback-nfl', name: 'NFL', sport: 'American Football', country: 'USA' },
    season: '2024',
    rows: [
      { position: 1, team: 'Kansas City Chiefs', played: 17, win: 12, draw: 0, loss: 5, points: 24 },
      { position: 2, team: 'Baltimore Ravens', played: 17, win: 12, draw: 0, loss: 5, points: 24 },
      { position: 3, team: 'San Francisco 49ers', played: 17, win: 11, draw: 0, loss: 6, points: 22 },
      { position: 4, team: 'Detroit Lions', played: 17, win: 12, draw: 0, loss: 5, points: 24 },
      { position: 5, team: 'Buffalo Bills', played: 17, win: 11, draw: 0, loss: 6, points: 22 },
      { position: 6, team: 'Dallas Cowboys', played: 17, win: 10, draw: 0, loss: 7, points: 20 },
    ],
  },
  au: {
    league: { id: 'fallback-bbl', name: 'Big Bash League', sport: 'Cricket', country: 'Australia' },
    season: '2024-2025',
    rows: [
      { position: 1, team: 'Perth Scorchers', played: 10, win: 7, draw: 0, loss: 3, points: 14 },
      { position: 2, team: 'Sydney Sixers', played: 10, win: 6, draw: 0, loss: 4, points: 12 },
      { position: 3, team: 'Brisbane Heat', played: 10, win: 6, draw: 0, loss: 4, points: 12 },
      { position: 4, team: 'Sydney Thunder', played: 10, win: 5, draw: 0, loss: 5, points: 10 },
      { position: 5, team: 'Melbourne Stars', played: 10, win: 5, draw: 0, loss: 5, points: 10 },
      { position: 6, team: 'Adelaide Strikers', played: 10, win: 4, draw: 0, loss: 6, points: 8 },
    ],
  },
};

const LEAGUE_PREFS = {
  us: { sport: 'American Football', country: 'USA', hints: ['NFL'], seasonStyle: 'year', espn: { sport: 'football', league: 'nfl', name: 'NFL' } },
  ca: { sport: 'Ice Hockey', country: 'USA', hints: ['NHL'], seasonStyle: 'split', espn: { sport: 'hockey', league: 'nhl', name: 'NHL' } },
  gb: { sport: 'Soccer', country: 'England', hints: ['Premier League'], seasonStyle: 'split', espn: { sport: 'soccer', league: 'eng.1', name: 'Premier League' } },
  de: { sport: 'Soccer', country: 'Germany', hints: ['Bundesliga'], seasonStyle: 'split', espn: { sport: 'soccer', league: 'ger.1', name: 'Bundesliga' } },
  fr: { sport: 'Soccer', country: 'France', hints: ['Ligue 1'], seasonStyle: 'split', espn: { sport: 'soccer', league: 'fra.1', name: 'Ligue 1' } },
  es: { sport: 'Soccer', country: 'Spain', hints: ['La Liga'], seasonStyle: 'split', espn: { sport: 'soccer', league: 'esp.1', name: 'La Liga' } },
  it: { sport: 'Soccer', country: 'Italy', hints: ['Serie A'], seasonStyle: 'split', espn: { sport: 'soccer', league: 'ita.1', name: 'Serie A' } },
  au: {
    sport: 'Cricket',
    country: 'Australia',
    hints: ['Big Bash', 'BBL'],
    seasonStyle: 'split',
    espnCandidates: [
      { sport: 'cricket', league: 'bbl', name: 'Big Bash League' },
      { sport: 'australian-football', league: 'afl', name: 'AFL' },
    ],
  },
  ru: { sport: 'Soccer', country: 'Russia', hints: ['Premier League'], seasonStyle: 'split', espn: { sport: 'soccer', league: 'rus.1', name: 'Russian Premier League' } },
  br: { sport: 'Soccer', country: 'Brazil', hints: ['Serie A'], seasonStyle: 'year', espn: { sport: 'soccer', league: 'bra.1', name: 'Brasileirao' } },
  ar: { sport: 'Soccer', country: 'Argentina', hints: ['Primera'], seasonStyle: 'year', espn: { sport: 'soccer', league: 'arg.1', name: 'Argentine Primera Division' } },
  mx: { sport: 'Soccer', country: 'Mexico', hints: ['Liga MX'], seasonStyle: 'split', espn: { sport: 'soccer', league: 'mex.1', name: 'Liga MX' } },
  jp: { sport: 'Baseball', country: 'Japan', hints: ['Nippon', 'NPB'], seasonStyle: 'year' },
  kr: { sport: 'Baseball', country: 'South Korea', hints: ['KBO'], seasonStyle: 'year' },
  cn: { sport: 'Basketball', country: 'China', hints: ['CBA'], seasonStyle: 'split' },
  in: { sport: 'Cricket', country: 'India', hints: ['Premier League', 'IPL'], seasonStyle: 'year' },
};

export async function fetchCountryLeagueTable(countryCode, countryName) {
  const code = String(countryCode || '').toLowerCase();
  const key = `${code}:${String(countryName || '').toLowerCase()}`;
  const cached = _cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const pref = resolveLeaguePref(code, countryName);
  if (!pref) {
    return {
      table: [],
      league: null,
      season: null,
      isFallbackSeason: false,
      error: 'No supported sports league mapping for this country yet.',
    };
  }

  try {
    const espnSpecs = [];
    if (pref.espn) espnSpecs.push(pref.espn);
    if (Array.isArray(pref.espnCandidates)) espnSpecs.push(...pref.espnCandidates);

    for (const spec of espnSpecs) {
      const espn = await fetchEspnStandings(spec);
      if (espn.table.length > 0) {
        const payload = {
          table: espn.table,
          league: espn.league,
          season: espn.season,
          isFallbackSeason: false,
          error: null,
        };
        _cache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
        return payload;
      }
    }

    const leagues = await searchLeagues(pref.sport, pref.country);
    const league = pickBestLeague(leagues, pref.hints);
    if (!league?.idLeague) {
      return {
        table: [],
        league: null,
        season: null,
        isFallbackSeason: false,
        error: 'Could not find a matching league table source.',
      };
    }

    const seasons = buildSeasonCandidates(pref.seasonStyle);
    let selectedSeason = null;
    let rows = [];

    for (const season of seasons) {
      const maybeRows = await fetchLeagueTableRows(league.idLeague, season);
      if (maybeRows.length > 0) {
        rows = maybeRows;
        selectedSeason = season;
        break;
      }
    }

    if (rows.length === 0) {
      // Last attempt: some leagues expose current table without season.
      rows = await fetchLeagueTableRows(league.idLeague, null);
    }

    if (rows.length === 0) {
      const fallback = getFallbackSnapshot(code);
      if (fallback) return fallback;
      return {
        table: [],
        league: formatLeagueMeta(league),
        season: null,
        isFallbackSeason: false,
        error: 'League table is unavailable right now.',
      };
    }

    const payload = {
      table: rows,
      league: formatLeagueMeta(league),
      season: selectedSeason,
      isFallbackSeason: Boolean(selectedSeason && selectedSeason !== seasons[0]),
      error: null,
    };

    _cache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
    return payload;
  } catch (err) {
    const fallback = getFallbackSnapshot(code);
    if (fallback) return fallback;
    return {
      table: [],
      league: null,
      season: null,
      isFallbackSeason: false,
      error: `Sports table fetch failed: ${formatError(err)}`,
    };
  }
}

function resolveLeaguePref(code, countryName) {
  if (LEAGUE_PREFS[code]) return LEAGUE_PREFS[code];
  const name = String(countryName || '').toLowerCase();

  if (name.includes('england')) return LEAGUE_PREFS.gb;
  if (name.includes('germany')) return LEAGUE_PREFS.de;
  if (name.includes('france')) return LEAGUE_PREFS.fr;
  if (name.includes('spain')) return LEAGUE_PREFS.es;
  if (name.includes('italy')) return LEAGUE_PREFS.it;
  if (name.includes('canada')) return LEAGUE_PREFS.ca;
  if (name.includes('united states') || name.includes('america')) return LEAGUE_PREFS.us;

  // Generic fallback: attempt domestic football league discovery via SportsDB.
  if (countryName) {
    return {
      sport: 'Soccer',
      country: String(countryName),
      hints: ['Premier', 'League', 'Division'],
      seasonStyle: 'split',
    };
  }

  return null;
}

function buildSeasonCandidates(style) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  if (style === 'year') {
    return [
      String(year),
      String(year - 1),
      String(year - 2),
      `${year}-${year + 1}`,
      `${year - 1}-${year}`,
    ];
  }

  const startYear = month >= 7 ? year : year - 1;
  return [
    `${startYear}-${startYear + 1}`,
    `${startYear - 1}-${startYear}`,
    `${startYear - 2}-${startYear - 1}`,
    String(startYear),
    String(startYear - 1),
  ];
}

async function searchLeagues(sport, country) {
  const params = new URLSearchParams({ s: sport, c: country });
  const data = await httpGetJson(`${SPORTSDB_BASE}/search_all_leagues.php?${params}`);
  return Array.isArray(data?.countries) ? data.countries : [];
}

function pickBestLeague(leagues, hints = []) {
  if (!Array.isArray(leagues) || leagues.length === 0) return null;
  if (!Array.isArray(hints) || hints.length === 0) return leagues[0];

  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const match = leagues.find((league) => {
    const name = String(league?.strLeague || '').toLowerCase();
    const alt = String(league?.strLeagueAlternate || '').toLowerCase();
    return lowerHints.some((hint) => name.includes(hint) || alt.includes(hint));
  });

  return match || leagues[0];
}

async function fetchLeagueTableRows(leagueId, season) {
  const params = new URLSearchParams({ l: String(leagueId) });
  if (season) params.set('s', season);

  const data = await httpGetJson(`${SPORTSDB_BASE}/lookuptable.php?${params}`);
  const rows = Array.isArray(data?.table) ? data.table : [];

  return rows
    .map((row) => normalizeTableRow(row))
    .filter((row) => row.team)
    .sort((a, b) => a.position - b.position);
}

function normalizeTableRow(row) {
  return {
    position: toInt(row?.intRank, 999),
    team: row?.strTeam || '',
    played: toInt(row?.intPlayed, 0),
    win: toInt(row?.intWin, 0),
    draw: toInt(row?.intDraw, 0),
    loss: toInt(row?.intLoss, 0),
    points: toInt(row?.intPoints, 0),
    goalsFor: toInt(row?.intGoalsFor, 0),
    goalsAgainst: toInt(row?.intGoalsAgainst, 0),
    goalDifference: toInt(row?.intGoalDifference, 0),
    badge: row?.strBadge || null,
  };
}

function formatLeagueMeta(league) {
  return {
    id: league?.idLeague || null,
    name: league?.strLeague || null,
    sport: league?.strSport || null,
    country: league?.strCountry || null,
  };
}

function toInt(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

async function httpGetJson(url) {
  const { statusCode, body } = await httpGet(url, REQUEST_TIMEOUT_MS, {
    Accept: 'application/json',
    'User-Agent': 'News-Globe/1.0 (+https://localhost)',
  });

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`HTTP ${statusCode}`);
  }

  const parsed = tryParseJsonBody(body);
  if (!parsed) throw new Error('Upstream returned non-JSON response');
  return parsed;
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
  if (typeof err.message === 'string') {
    const msg = err.message.toLowerCase();
    if (msg.includes('non-json') || msg.includes('invalid json')) {
      return 'provider unavailable';
    }
    return err.message;
  }
  return 'network error';
}

async function fetchEspnStandings(spec) {
  const url = `https://site.api.espn.com/apis/v2/sports/${spec.sport}/${spec.league}/standings`;
  const data = await httpGetJson(url);

  const entries = extractEspnEntries(data);
  const table = entries
    .map((entry, idx) => normalizeEspnRow(entry, idx + 1))
    .filter((row) => row.team)
    .sort((a, b) => (a.position - b.position) || (b.points - a.points));

  const leagueName = data?.name || spec.name || spec.league;
  const seasonLabel = data?.season?.displayName || String(data?.season?.year || '');

  return {
    table,
    league: {
      id: `espn-${spec.sport}-${spec.league}`,
      name: leagueName,
      sport: capitalize(spec.sport),
      country: null,
    },
    season: seasonLabel || null,
  };
}

function extractEspnEntries(data) {
  const out = [];
  const push = (entries) => {
    if (Array.isArray(entries)) out.push(...entries);
  };

  push(data?.standings?.entries);
  for (const child of data?.children || []) {
    push(child?.standings?.entries);
    for (const subgroup of child?.children || []) {
      push(subgroup?.standings?.entries);
    }
  }

  return out;
}

function normalizeEspnRow(entry, fallbackPosition) {
  const stats = Array.isArray(entry?.stats) ? entry.stats : [];
  const statMap = new Map();
  for (const stat of stats) {
    const key = String(stat?.name || stat?.abbreviation || '').toLowerCase();
    if (!key) continue;
    statMap.set(key, stat?.value);
  }

  const position = toInt(
    statMap.get('rank')
    ?? statMap.get('standing')
    ?? statMap.get('position')
    ?? fallbackPosition,
    fallbackPosition
  );

  const played = toInt(statMap.get('gamesplayed') ?? statMap.get('gp') ?? statMap.get('played'), 0);
  const win = toInt(statMap.get('wins') ?? statMap.get('w'), 0);
  const draw = toInt(statMap.get('draws') ?? statMap.get('d'), 0);
  const loss = toInt(statMap.get('losses') ?? statMap.get('l'), 0);
  const points = toInt(
    statMap.get('points')
    ?? statMap.get('pts')
    ?? statMap.get('leaguepoints')
    ?? (win * 3 + draw),
    0
  );

  return {
    position,
    team: entry?.team?.displayName || entry?.team?.shortDisplayName || '',
    played,
    win,
    draw,
    loss,
    points,
    goalsFor: toInt(statMap.get('pointsfor') ?? statMap.get('pf'), 0),
    goalsAgainst: toInt(statMap.get('pointsagainst') ?? statMap.get('pa'), 0),
    goalDifference: toInt(statMap.get('pointdifferential') ?? statMap.get('gd'), 0),
    badge: entry?.team?.logos?.[0]?.href || null,
  };
}

function capitalize(value) {
  const text = String(value || '');
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function tryParseJsonBody(body) {
  const text = String(body || '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // Some upstream responses prepend non-JSON text or wrappers; salvage JSON object/array.
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    const startCandidates = [firstBrace, firstBracket].filter((n) => n >= 0);
    if (startCandidates.length === 0) return null;
    const start = Math.min(...startCandidates);
    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);
    if (end <= start) return null;
    const sliced = text.slice(start, end + 1);
    try {
      return JSON.parse(sliced);
    } catch {
      return null;
    }
  }
}

function getFallbackSnapshot(code) {
  const snap = FALLBACK_SNAPSHOTS[String(code || '').toLowerCase()];
  if (!snap) return null;
  return {
    table: snap.rows.map((row) => ({
      ...row,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      badge: null,
    })),
    league: snap.league,
    season: snap.season,
    isFallbackSeason: true,
    error: 'Live standings provider unavailable; showing latest cached season snapshot.',
  };
}
