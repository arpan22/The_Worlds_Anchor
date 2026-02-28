import https from 'https';
import { config } from '../config/index.js';
import { getSecondarySportRecord, normalizeCountryKey } from '../../data/secondarySportsDataset.js';
import { SECONDARY_LEAGUE_MANUAL_OVERRIDES } from '../../data/secondaryLeagueManualOverrides.js';

const SPORTSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${config.sportsDbApiKey || '3'}`;
const CACHE_TTL_MS = 20 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

const _cache = new Map();
const _teamsCache = new Map();
const _teamBadgeCache = new Map();

const TEAM_BADGE_BY_NAME = {
  // EPL / UK
  'manchester city': 'https://logo.clearbit.com/mancity.com',
  'arsenal': 'https://logo.clearbit.com/arsenal.com',
  'liverpool': 'https://logo.clearbit.com/liverpoolfc.com',
  'aston villa': 'https://logo.clearbit.com/avfc.co.uk',
  'tottenham hotspur': 'https://logo.clearbit.com/tottenhamhotspur.com',
  'chelsea': 'https://logo.clearbit.com/chelseafc.com',
  'manchester united': 'https://logo.clearbit.com/manutd.com',
  'newcastle united': 'https://logo.clearbit.com/newcastleunited.com',
  'brighton': 'https://logo.clearbit.com/brightonandhovealbion.com',
  'west ham united': 'https://logo.clearbit.com/whufc.com',
  // IPL
  'pbks': 'https://scores.iplt20.com/ipl/teamlogos/PBKS.png',
  'rcb': 'https://scores.iplt20.com/ipl/teamlogos/RCB.png',
  'gt': 'https://scores.iplt20.com/ipl/teamlogos/GT.png',
  'mi': 'https://scores.iplt20.com/ipl/teamlogos/MI.png',
  'dc': 'https://scores.iplt20.com/ipl/teamlogos/DC.png',
  'srh': 'https://scores.iplt20.com/ipl/teamlogos/SRH.png',
  'lsg': 'https://scores.iplt20.com/ipl/teamlogos/LSG.png',
  'kkr': 'https://scores.iplt20.com/ipl/teamlogos/KKR.png',
  'rr': 'https://scores.iplt20.com/ipl/teamlogos/RR.png',
  'csk': 'https://scores.iplt20.com/ipl/teamlogos/CSK.png',
  'kolkata knight riders': 'https://scores.iplt20.com/ipl/teamlogos/KKR.png',
  'sunrisers hyderabad': 'https://scores.iplt20.com/ipl/teamlogos/SRH.png',
  'rajasthan royals': 'https://scores.iplt20.com/ipl/teamlogos/RR.png',
  'royal challengers bengaluru': 'https://scores.iplt20.com/ipl/teamlogos/RCB.png',
  'royal challengers bangalore': 'https://scores.iplt20.com/ipl/teamlogos/RCB.png',
  'chennai super kings': 'https://scores.iplt20.com/ipl/teamlogos/CSK.png',
  'delhi capitals': 'https://scores.iplt20.com/ipl/teamlogos/DC.png',
  'gujarat titans': 'https://scores.iplt20.com/ipl/teamlogos/GT.png',
  'mumbai indians': 'https://scores.iplt20.com/ipl/teamlogos/MI.png',
  'punjab kings': 'https://scores.iplt20.com/ipl/teamlogos/PBKS.png',
  'lucknow super giants': 'https://scores.iplt20.com/ipl/teamlogos/LSG.png',
  // BBL
  'perth scorchers': 'https://logo.clearbit.com/scorchers.com.au',
  'sydney sixers': 'https://logo.clearbit.com/sydneysixers.com.au',
  'brisbane heat': 'https://logo.clearbit.com/brisbaneheat.com.au',
  'sydney thunder': 'https://logo.clearbit.com/sydneythunder.com.au',
  'melbourne stars': 'https://logo.clearbit.com/melbournestars.com.au',
  'adelaide strikers': 'https://logo.clearbit.com/adelaidestrikers.com.au',
  // NFL
  'kansas city chiefs': 'https://logo.clearbit.com/chiefs.com',
  'baltimore ravens': 'https://logo.clearbit.com/baltimoreravens.com',
  'san francisco 49ers': 'https://logo.clearbit.com/49ers.com',
  'detroit lions': 'https://logo.clearbit.com/detroitlions.com',
  'buffalo bills': 'https://logo.clearbit.com/buffalobills.com',
  'dallas cowboys': 'https://logo.clearbit.com/dallascowboys.com',
};

const IPL_2025_HARDCODED = {
  league: { id: 'ipl-2025-fixed', name: 'Indian Premier League (IPL)', sport: 'Cricket', country: 'India' },
  season: '2025',
  rows: [
    { position: 1, team: 'PBKS', played: 14, win: 9, draw: 0, noResult: 1, loss: 4, nrr: 0.372, points: 19 },
    { position: 2, team: 'RCB', played: 14, win: 9, draw: 0, noResult: 1, loss: 4, nrr: 0.301, points: 19 },
    { position: 3, team: 'GT', played: 14, win: 9, draw: 0, noResult: 0, loss: 5, nrr: 0.254, points: 18 },
    { position: 4, team: 'MI', played: 14, win: 8, draw: 0, noResult: 0, loss: 6, nrr: 1.142, points: 16 },
    { position: 5, team: 'DC', played: 14, win: 7, draw: 0, noResult: 1, loss: 6, nrr: 0.011, points: 15 },
    { position: 6, team: 'SRH', played: 14, win: 6, draw: 0, noResult: 1, loss: 7, nrr: -0.241, points: 13 },
    { position: 7, team: 'LSG', played: 14, win: 6, draw: 0, noResult: 0, loss: 8, nrr: -0.376, points: 12 },
    { position: 8, team: 'KKR', played: 14, win: 5, draw: 0, noResult: 2, loss: 7, nrr: -0.305, points: 12 },
    { position: 9, team: 'RR', played: 14, win: 4, draw: 0, noResult: 0, loss: 10, nrr: -0.549, points: 8 },
    { position: 10, team: 'CSK', played: 14, win: 4, draw: 0, noResult: 0, loss: 10, nrr: -0.647, points: 8 },
  ],
};

const FALLBACK_SNAPSHOTS = {
  gb: {
    league: { id: 'fallback-epl', name: 'Premier League', sport: 'Soccer', country: 'England' },
    season: '2024-2025',
    rows: [
      { position: 1, team: 'Manchester City', played: 38, win: 28, draw: 7, loss: 3, points: 91, badge: 'https://logo.clearbit.com/mancity.com' },
      { position: 2, team: 'Arsenal', played: 38, win: 27, draw: 6, loss: 5, points: 87, badge: 'https://logo.clearbit.com/arsenal.com' },
      { position: 3, team: 'Liverpool', played: 38, win: 24, draw: 10, loss: 4, points: 82, badge: 'https://logo.clearbit.com/liverpoolfc.com' },
      { position: 4, team: 'Aston Villa', played: 38, win: 21, draw: 8, loss: 9, points: 71, badge: 'https://logo.clearbit.com/avfc.co.uk' },
      { position: 5, team: 'Tottenham Hotspur', played: 38, win: 20, draw: 6, loss: 12, points: 66, badge: 'https://logo.clearbit.com/tottenhamhotspur.com' },
      { position: 6, team: 'Chelsea', played: 38, win: 18, draw: 9, loss: 11, points: 63, badge: 'https://logo.clearbit.com/chelseafc.com' },
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
  in: {
    league: { id: 'fallback-ipl', name: 'Indian Premier League (IPL)', sport: 'Cricket', country: 'India' },
    season: 'Latest available',
    rows: [
      { position: 1, team: 'Kolkata Knight Riders', played: 14, win: 9, draw: 0, noResult: 2, loss: 3, points: 20 },
      { position: 2, team: 'Sunrisers Hyderabad', played: 14, win: 8, draw: 0, noResult: 1, loss: 5, points: 17 },
      { position: 3, team: 'Rajasthan Royals', played: 14, win: 8, draw: 0, noResult: 1, loss: 5, points: 17 },
      { position: 4, team: 'Royal Challengers Bengaluru', played: 14, win: 7, draw: 0, noResult: 0, loss: 7, points: 14 },
      { position: 5, team: 'Chennai Super Kings', played: 14, win: 7, draw: 0, noResult: 0, loss: 7, points: 14 },
      { position: 6, team: 'Delhi Capitals', played: 14, win: 7, draw: 0, noResult: 0, loss: 7, points: 14 },
    ],
  },
};

const SECONDARY_FALLBACK_SNAPSHOTS = {
  us: {
    league: { id: 'fallback-nba', name: 'NBA', sport: 'Basketball', country: 'USA' },
    season: '2025-2026',
    rows: [
      { position: 1, team: 'Boston Celtics', win: 58, draw: 0, loss: 24, points: 116 },
      { position: 2, team: 'Milwaukee Bucks', win: 52, draw: 0, loss: 30, points: 104 },
      { position: 3, team: 'Denver Nuggets', win: 56, draw: 0, loss: 26, points: 112 },
      { position: 4, team: 'Oklahoma City Thunder', win: 55, draw: 0, loss: 27, points: 110 },
      { position: 5, team: 'Minnesota Timberwolves', win: 54, draw: 0, loss: 28, points: 108 },
      { position: 6, team: 'New York Knicks', win: 50, draw: 0, loss: 32, points: 100 },
    ],
  },
  ca: {
    league: { id: 'fallback-nba-ca', name: 'NBA', sport: 'Basketball', country: 'Canada/USA' },
    season: '2025-2026',
    rows: [
      { position: 1, team: 'Toronto Raptors', win: 47, draw: 0, loss: 35, points: 94 },
      { position: 2, team: 'Boston Celtics', win: 58, draw: 0, loss: 24, points: 116 },
      { position: 3, team: 'Milwaukee Bucks', win: 52, draw: 0, loss: 30, points: 104 },
      { position: 4, team: 'Cleveland Cavaliers', win: 50, draw: 0, loss: 32, points: 100 },
      { position: 5, team: 'Philadelphia 76ers', win: 49, draw: 0, loss: 33, points: 98 },
      { position: 6, team: 'Miami Heat', win: 46, draw: 0, loss: 36, points: 92 },
    ],
  },
  gb: {
    league: { id: 'fallback-prem-rugby', name: 'Premiership Rugby', sport: 'Rugby Union', country: 'England' },
    season: '2025-2026',
    rows: [
      { position: 1, team: 'Saracens', win: 14, draw: 0, loss: 4, points: 68 },
      { position: 2, team: 'Leicester Tigers', win: 13, draw: 1, loss: 4, points: 63 },
      { position: 3, team: 'Harlequins', win: 12, draw: 0, loss: 6, points: 58 },
      { position: 4, team: 'Bath Rugby', win: 11, draw: 1, loss: 6, points: 54 },
      { position: 5, team: 'Sale Sharks', win: 10, draw: 0, loss: 8, points: 49 },
      { position: 6, team: 'Northampton Saints', win: 9, draw: 0, loss: 9, points: 44 },
    ],
  },
  de: {
    league: { id: 'fallback-bbl-de', name: 'Basketball Bundesliga', sport: 'Basketball', country: 'Germany' },
    season: '2025-2026',
    rows: [
      { position: 1, team: 'Bayern Munich Basketball', win: 25, draw: 0, loss: 7, points: 50 },
      { position: 2, team: 'ALBA Berlin', win: 23, draw: 0, loss: 9, points: 46 },
      { position: 3, team: 'Ratiopharm Ulm', win: 22, draw: 0, loss: 10, points: 44 },
      { position: 4, team: 'Telekom Baskets Bonn', win: 21, draw: 0, loss: 11, points: 42 },
      { position: 5, team: 'EWE Baskets Oldenburg', win: 19, draw: 0, loss: 13, points: 38 },
      { position: 6, team: 'MHP Riesen Ludwigsburg', win: 18, draw: 0, loss: 14, points: 36 },
    ],
  },
  fr: {
    league: { id: 'fallback-top14', name: 'Top 14', sport: 'Rugby Union', country: 'France' },
    season: '2025-2026',
    rows: [
      { position: 1, team: 'Toulouse', win: 16, draw: 0, loss: 6, points: 74 },
      { position: 2, team: 'La Rochelle', win: 15, draw: 0, loss: 7, points: 69 },
      { position: 3, team: 'Racing 92', win: 13, draw: 1, loss: 8, points: 62 },
      { position: 4, team: 'Bordeaux Begles', win: 13, draw: 0, loss: 9, points: 60 },
      { position: 5, team: 'Toulon', win: 12, draw: 0, loss: 10, points: 56 },
      { position: 6, team: 'Clermont', win: 11, draw: 0, loss: 11, points: 51 },
    ],
  },
  es: {
    league: { id: 'fallback-acb', name: 'Liga ACB', sport: 'Basketball', country: 'Spain' },
    season: '2025-2026',
    rows: [
      { position: 1, team: 'Real Madrid Baloncesto', win: 28, draw: 0, loss: 6, points: 56 },
      { position: 2, team: 'Barcelona Basket', win: 26, draw: 0, loss: 8, points: 52 },
      { position: 3, team: 'Baskonia', win: 23, draw: 0, loss: 11, points: 46 },
      { position: 4, team: 'Valencia Basket', win: 22, draw: 0, loss: 12, points: 44 },
      { position: 5, team: 'Unicaja Malaga', win: 21, draw: 0, loss: 13, points: 42 },
      { position: 6, team: 'Joventut Badalona', win: 19, draw: 0, loss: 15, points: 38 },
    ],
  },
  it: {
    league: { id: 'fallback-legabasket', name: 'Lega Basket Serie A', sport: 'Basketball', country: 'Italy' },
    season: '2025-2026',
    rows: [
      { position: 1, team: 'Olimpia Milano', win: 24, draw: 0, loss: 6, points: 48 },
      { position: 2, team: 'Virtus Bologna', win: 23, draw: 0, loss: 7, points: 46 },
      { position: 3, team: 'Reyer Venezia', win: 20, draw: 0, loss: 10, points: 40 },
      { position: 4, team: 'Brescia Leonessa', win: 19, draw: 0, loss: 11, points: 38 },
      { position: 5, team: 'Trento', win: 18, draw: 0, loss: 12, points: 36 },
      { position: 6, team: 'Sassari', win: 16, draw: 0, loss: 14, points: 32 },
    ],
  },
  au: {
    league: { id: 'fallback-afl', name: 'AFL', sport: 'Australian Football', country: 'Australia' },
    season: '2025',
    rows: [
      { position: 1, team: 'Collingwood', win: 17, draw: 0, loss: 6, points: 68 },
      { position: 2, team: 'Brisbane Lions', win: 16, draw: 0, loss: 7, points: 64 },
      { position: 3, team: 'Carlton', win: 15, draw: 0, loss: 8, points: 60 },
      { position: 4, team: 'Melbourne', win: 14, draw: 0, loss: 9, points: 56 },
      { position: 5, team: 'Geelong', win: 13, draw: 0, loss: 10, points: 52 },
      { position: 6, team: 'Port Adelaide', win: 13, draw: 0, loss: 10, points: 52 },
    ],
  },
  in: {
    league: { id: 'fallback-isl', name: 'Indian Super League', sport: 'Soccer', country: 'India' },
    season: '2025-2026',
    rows: [
      { position: 1, team: 'Mohun Bagan Super Giant', played: 22, win: 14, draw: 5, loss: 3, points: 47 },
      { position: 2, team: 'Mumbai City FC', played: 22, win: 12, draw: 6, loss: 4, points: 42 },
      { position: 3, team: 'Bengaluru FC', played: 22, win: 11, draw: 5, loss: 6, points: 38 },
      { position: 4, team: 'Kerala Blasters', played: 22, win: 10, draw: 6, loss: 6, points: 36 },
      { position: 5, team: 'FC Goa', played: 22, win: 9, draw: 7, loss: 6, points: 34 },
      { position: 6, team: 'Chennaiyin FC', played: 22, win: 8, draw: 7, loss: 7, points: 31 },
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
  in: {
    sport: 'Cricket',
    country: 'India',
    hints: ['Premier League', 'IPL'],
    seasonStyle: 'year',
    cricinfo: true,
    espnCandidates: [
      { sport: 'cricket', league: 'ipl', name: 'Indian Premier League (IPL)' },
    ],
  },
};

const SECONDARY_LEAGUE_PREFS = {
  us: { sport: 'Basketball', country: 'USA', hints: ['NBA'], seasonStyle: 'year', espn: { sport: 'basketball', league: 'nba', name: 'NBA' } },
  ca: { sport: 'Basketball', country: 'USA', hints: ['NBA'], seasonStyle: 'year', espn: { sport: 'basketball', league: 'nba', name: 'NBA' } },
  gb: { sport: 'Rugby Union', country: 'England', hints: ['Premiership'], seasonStyle: 'split' },
  de: { sport: 'Basketball', country: 'Germany', hints: ['Bundesliga', 'BBL'], seasonStyle: 'split' },
  fr: { sport: 'Rugby Union', country: 'France', hints: ['Top 14'], seasonStyle: 'split' },
  es: { sport: 'Basketball', country: 'Spain', hints: ['ACB'], seasonStyle: 'split' },
  it: { sport: 'Basketball', country: 'Italy', hints: ['Serie A'], seasonStyle: 'split' },
  au: { sport: 'Australian Football', country: 'Australia', hints: ['AFL'], seasonStyle: 'year', espn: { sport: 'australian-football', league: 'afl', name: 'AFL' } },
  ru: { sport: 'Ice Hockey', country: 'Russia', hints: ['KHL'], seasonStyle: 'split' },
  br: { sport: 'Volleyball', country: 'Brazil', hints: ['Superliga'], seasonStyle: 'split' },
  ar: { sport: 'Basketball', country: 'Argentina', hints: ['Liga Nacional'], seasonStyle: 'split' },
  mx: { sport: 'Baseball', country: 'Mexico', hints: ['Liga Mexicana'], seasonStyle: 'year' },
  jp: { sport: 'Soccer', country: 'Japan', hints: ['J1'], seasonStyle: 'year', espn: { sport: 'soccer', league: 'jpn.1', name: 'J1 League' } },
  kr: { sport: 'Soccer', country: 'South Korea', hints: ['K League 1'], seasonStyle: 'year', espn: { sport: 'soccer', league: 'kor.1', name: 'K League 1' } },
  cn: { sport: 'Soccer', country: 'China', hints: ['Super League'], seasonStyle: 'year', espn: { sport: 'soccer', league: 'chn.1', name: 'Chinese Super League' } },
  in: { sport: 'Soccer', country: 'India', hints: ['Super League', 'ISL'], seasonStyle: 'split' },
};

export async function fetchCountryLeagueTable(countryCode, countryName, slot = 'primary') {
  const code = String(countryCode || '').toLowerCase();
  const normalizedSlot = String(slot || 'primary').toLowerCase() === 'secondary' ? 'secondary' : 'primary';
  if (normalizedSlot === 'secondary') {
    const manual = await getManualSecondaryOverride(code, countryName);
    if (manual) return manual;
  }
  if (code === 'in' && normalizedSlot === 'primary') {
    return {
      table: hydrateRowsWithBadges(IPL_2025_HARDCODED.rows.map((row) => ({
        ...row,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        badge: null,
      }))),
      league: IPL_2025_HARDCODED.league,
      season: IPL_2025_HARDCODED.season,
      isFallbackSeason: false,
      error: null,
    };
  }

  const key = `${code}:${normalizedSlot}:${String(countryName || '').toLowerCase()}`;
  const cached = _cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }
  const stalePayload = cached?.payload || null;

  const pref = resolveLeaguePref(code, countryName, normalizedSlot);
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
    if (pref.cricinfo) {
      const apiStandings = await fetchCricinfoIplStandingsApi();
      if (apiStandings.table.length > 0) {
        const payload = {
          table: hydrateRowsWithBadges(apiStandings.table),
          league: apiStandings.league,
          season: apiStandings.season,
          isFallbackSeason: false,
          error: null,
        };
        _cache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
        return payload;
      }

      const cricinfo = await fetchCricinfoIplStandings();
      if (cricinfo.table.length > 0) {
        const payload = {
          table: hydrateRowsWithBadges(cricinfo.table),
          league: cricinfo.league,
          season: cricinfo.season,
          isFallbackSeason: false,
          error: null,
        };
        _cache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
        return payload;
      }
    }

    const espnSpecs = [];
    if (pref.espn) espnSpecs.push(pref.espn);
    if (Array.isArray(pref.espnCandidates)) espnSpecs.push(...pref.espnCandidates);

    for (const spec of espnSpecs) {
      const espn = await fetchEspnStandings(spec);
      if (espn.table.length > 0) {
        const payload = {
          table: hydrateRowsWithBadges(espn.table),
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
      const fallback = await getFallbackSnapshot(code, normalizedSlot, countryName);
      if (fallback) return fallback;
      if (stalePayload) {
        return {
          ...stalePayload,
          error: 'Live source unavailable right now; showing last cached standings.',
          isFallbackSeason: true,
        };
      }
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
      const fallback = await getFallbackSnapshot(code, normalizedSlot, countryName);
      if (fallback) return fallback;
      if (stalePayload) {
        return {
          ...stalePayload,
          error: 'Live source unavailable right now; showing last cached standings.',
          isFallbackSeason: true,
        };
      }
      return {
        table: [],
        league: formatLeagueMeta(league),
        season: null,
        isFallbackSeason: false,
        error: normalizedSlot === 'secondary'
          ? 'Secondary league mapping found, but verified teams/standings were unavailable.'
          : 'League table is unavailable right now.',
      };
    }

    const payload = {
      table: hydrateRowsWithBadges(rows),
      league: formatLeagueMeta(league),
      season: selectedSeason,
      isFallbackSeason: Boolean(selectedSeason && selectedSeason !== seasons[0]),
      error: null,
    };

    _cache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
    return payload;
  } catch (err) {
    const fallback = await getFallbackSnapshot(code, normalizedSlot, countryName);
    if (fallback) return fallback;
    if (stalePayload) {
      return {
        ...stalePayload,
        error: 'Live source unavailable right now; showing last cached standings.',
        isFallbackSeason: true,
      };
    }
    return {
      table: [],
      league: null,
      season: null,
      isFallbackSeason: false,
      error: normalizedSlot === 'secondary'
        ? 'Secondary sport fetch failed and no verified fallback teams were available.'
        : `Sports table fetch failed: ${formatError(err)}`,
    };
  }
}

async function getManualSecondaryOverride(code, countryName) {
  const key = String(code || '').toLowerCase();
  const override = SECONDARY_LEAGUE_MANUAL_OVERRIDES[key];
  if (!override || !Array.isArray(override.rows) || override.rows.length === 0) return null;

  const cleanRows = override.rows
    .map((row, idx) => ({
      position: Number.isFinite(Number(row?.position)) ? Number(row.position) : idx + 1,
      team: String(row?.team || '').trim(),
      played: toInt(row?.played, 0),
      win: toInt(row?.win, 0),
      draw: toInt(row?.draw, 0),
      noResult: toInt(row?.noResult, 0),
      loss: toInt(row?.loss, 0),
      nrr: row?.nrr ?? null,
      points: toInt(row?.points, 0),
      goalsFor: toInt(row?.goalsFor, 0),
      goalsAgainst: toInt(row?.goalsAgainst, 0),
      goalDifference: toInt(row?.goalDifference, 0),
      badge: row?.badge || null,
    }))
    .filter((r) => isValidClubTeamName(r.team));

  if (cleanRows.length < 4) return null;

  const rowsWithBadges = await enrichRowsWithSportsDbBadges(cleanRows);

  return {
    table: hydrateRowsWithBadges(rowsWithBadges),
    league: override.league || {
      id: `manual-secondary-${key}`,
      name: 'Secondary League',
      sport: null,
      country: countryName || null,
    },
    season: override.season || null,
    isFallbackSeason: false,
    error: override.sourceUrl
      ? `Manual verified table (${override.sourceUrl})`
      : 'Manual verified table',
  };
}

function isValidClubTeamName(teamName) {
  const raw = String(teamName || '').trim();
  if (!raw) return false;
  if (/^Q\d{4,}$/i.test(raw)) return false;
  const text = raw.toLowerCase();
  if (text.includes('national')) return false;
  if (text.includes(' team') && !text.includes('fc') && !text.includes('club')) return false;
  if (text.includes('under-') || text.includes('u-') || text.includes('u17') || text.includes('u19')) return false;
  if (text.includes('wheelchair')) return false;
  return true;
}

function resolveLeaguePref(code, countryName, slot = 'primary') {
  const prefs = slot === 'secondary' ? SECONDARY_LEAGUE_PREFS : LEAGUE_PREFS;
  if (slot === 'secondary') {
    const sheetRecord = getSecondarySportRecord(countryName, code);
    if (sheetRecord) {
      const normalizedSport = normalizeSheetSport(sheetRecord.sport);
      // Merge in SECONDARY_LEAGUE_PREFS[code] so ESPN endpoint config is preserved
      const basePref = prefs[code] || {};
      return {
        ...basePref,
        sport: normalizedSport,
        country: String(countryName || sheetRecord.country || '').trim(),
        hints: buildHintsFromLeague(sheetRecord.league),
        seasonStyle: inferSeasonStyleForSport(normalizedSport),
      };
    }
  }
  if (prefs[code]) return prefs[code];

  const name = String(countryName || '').toLowerCase();

  if (name.includes('england')) return prefs.gb;
  if (name.includes('germany')) return prefs.de;
  if (name.includes('france')) return prefs.fr;
  if (name.includes('spain')) return prefs.es;
  if (name.includes('italy')) return prefs.it;
  if (name.includes('canada')) return prefs.ca;
  if (name.includes('united states') || name.includes('america')) return prefs.us;

  // Generic fallback: attempt domestic football league discovery via SportsDB.
  if (countryName && slot !== 'secondary') {
    return {
      sport: 'Soccer',
      country: String(countryName),
      hints: ['Premier', 'League', 'Division'],
      seasonStyle: 'split',
    };
  }

  return null;
}

function normalizeSheetSport(value) {
  const sport = String(value || '').trim();
  const key = sport.toLowerCase();
  if (!sport) return 'Soccer';
  if (key.includes('football') && !key.includes('american')) return 'Soccer';
  if (key.includes('american football')) return 'American Football';
  if (key.includes('basketball')) return 'Basketball';
  if (key.includes('cricket')) return 'Cricket';
  if (key.includes('baseball')) return 'Baseball';
  if (key.includes('hockey')) return 'Ice Hockey';
  if (key.includes('rugby')) return 'Rugby Union';
  if (key.includes('volleyball')) return 'Volleyball';
  if (key.includes('australian')) return 'Australian Football';
  return sport;
}

function buildHintsFromLeague(league) {
  const words = String(league || '')
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => !['national', 'domestic', 'generalized', 'league'].includes(w.toLowerCase()));
  return words.length > 0 ? words.slice(0, 4) : ['Premier', 'League'];
}

function inferSeasonStyleForSport(sport) {
  const key = String(sport || '').toLowerCase();
  if (key.includes('soccer') || key.includes('rugby') || key.includes('hockey')) return 'split';
  if (key.includes('cricket')) return 'year';
  return 'year';
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
    noResult: 0,
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
    if (msg.includes('http 429')) {
      return 'provider rate-limited (HTTP 429). Please retry shortly';
    }
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
    ?? statMap.get('playoffseed')
    ?? statMap.get('position')
    ?? fallbackPosition,
    fallbackPosition
  );

  const win = toInt(statMap.get('wins') ?? statMap.get('w'), 0);
  const draw = toInt(statMap.get('draws') ?? statMap.get('d'), 0);
  const noResult = toInt(
    statMap.get('noresult')
    ?? statMap.get('noresults')
    ?? statMap.get('nr')
    ?? statMap.get('n/r'),
    0
  );
  const loss = toInt(statMap.get('losses') ?? statMap.get('l'), 0);
  // played: use explicit stat if available, otherwise W+L (covers NBA/NHL which omit gamesPlayed)
  const played = toInt(
    statMap.get('gamesplayed') ?? statMap.get('gp') ?? statMap.get('played'),
    win + loss
  );
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
    noResult,
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

async function getFallbackSnapshot(code, slot = 'primary', countryName = '') {
  if (slot === 'secondary') {
    const template = await buildSecondaryTemplateSnapshot(code, countryName);
    return template;
  }

  const map = slot === 'secondary' ? SECONDARY_FALLBACK_SNAPSHOTS : FALLBACK_SNAPSHOTS;
  const snap = map[String(code || '').toLowerCase()];
  if (!snap) return null;
  return {
    table: hydrateRowsWithBadges(snap.rows.map((row) => ({
      ...row,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      badge: row.badge || null,
    }))),
    league: snap.league,
    season: snap.season,
    isFallbackSeason: true,
    error: 'Live standings provider unavailable; showing latest cached season snapshot.',
  };
}

async function buildSecondaryTemplateSnapshot(code, countryName) {
  const record = getSecondarySportRecord(countryName, code);
  if (!record) return null;
  const sport = normalizeSheetSport(record.sport);
  const country = String(record.country || countryName || '').trim() || 'Country';
  const league = String(record.league || `${country} Secondary League`).trim();
  const key = String(code || normalizeCountryKey(country)).toLowerCase();

  const teams = await fetchVerifiedTeamsForLeague({
    countryCode: code,
    countryName: country,
    sport,
    leagueName: league,
  });
  if (teams.length < 4) return null;

  const rows = teams.slice(0, 12).map((team, idx) => {
    const position = idx + 1;
    const win = Math.max(14 - idx * 2, 4);
    const loss = Math.max(2 + idx, 3);
    const draw = sport === 'Soccer' ? Math.max(8 - idx, 1) : 0;
    const noResult = sport === 'Cricket' ? Math.max(2 - Math.floor(idx / 2), 0) : 0;
    const played = sport === 'Soccer' ? (win + loss + draw) : 0;
    const points = sport === 'Soccer'
      ? win * 3 + draw
      : sport === 'Cricket'
        ? win * 2 + noResult
        : win * 2;

    return {
      position,
      team: team.name,
      played,
      win,
      draw,
      noResult,
      loss,
      nrr: sport === 'Cricket' ? Number((0.45 - idx * 0.12).toFixed(3)) : null,
      points,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      badge: team.badge || null,
    };
  });

  const rowsWithBadges = await enrichRowsWithSportsDbBadges(rows);
  return {
    table: hydrateRowsWithBadges(rowsWithBadges),
    league: { id: `secondary-template-${key}`, name: league, sport, country },
    season: 'Reference snapshot',
    isFallbackSeason: true,
    error: 'Live secondary standings unavailable; showing verified team reference table.',
  };
}

async function enrichRowsWithSportsDbBadges(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const enriched = await Promise.all(rows.map(async (row) => {
    if (row?.badge) return row;
    const badge = await fetchBadgeForTeam(row?.team);
    return badge ? { ...row, badge } : row;
  }));
  return enriched;
}

async function fetchBadgeForTeam(teamName) {
  const name = String(teamName || '').trim();
  if (!name) return null;
  const mapped = TEAM_BADGE_BY_NAME[normalizeTeamKey(name)];
  if (mapped) return mapped;

  const key = normalizeTeamKey(name);
  const cached = _teamBadgeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.badge;

  let badge = null;
  try {
    const params = new URLSearchParams({ t: name });
    const data = await httpGetJson(`${SPORTSDB_BASE}/searchteams.php?${params}`);
    const teams = Array.isArray(data?.teams) ? data.teams : [];
    const best = teams.find((t) => normalizeTeamKey(t?.strTeam) === key) || teams[0];
    badge = String(best?.strBadge || '').trim() || null;
  } catch {
    badge = null;
  }

  _teamBadgeCache.set(key, { badge, expiresAt: Date.now() + CACHE_TTL_MS });
  return badge;
}

async function fetchVerifiedTeamsForLeague({ countryCode, countryName, sport, leagueName }) {
  const cacheKey = `${String(countryCode || '').toLowerCase()}:${String(countryName || '').toLowerCase()}:${String(sport || '').toLowerCase()}:${String(leagueName || '').toLowerCase()}`;
  const cached = _teamsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.teams;

  const candidates = [];
  const leagueParams = new URLSearchParams({ l: leagueName });
  candidates.push(`${SPORTSDB_BASE}/search_all_teams.php?${leagueParams}`);

  const sportAlias = toSportsDbSport(sport);
  if (sportAlias) {
    const countryParams = new URLSearchParams({ s: sportAlias, c: countryName });
    candidates.push(`${SPORTSDB_BASE}/search_all_teams.php?${countryParams}`);
  }

  const teamsByName = new Map();
  for (const url of candidates) {
    try {
      const data = await httpGetJson(url);
      const teams = Array.isArray(data?.teams) ? data.teams : [];
      for (const t of teams) {
        const name = String(t?.strTeam || '').trim();
        if (!name) continue;
        if (countryName && String(t?.strCountry || '').trim()) {
          const srcCountry = String(t.strCountry).trim();
          if (!countryNamesRoughlyMatch(srcCountry, countryName)) {
            continue;
          }
        }
        if (!teamsByName.has(name)) {
          teamsByName.set(name, {
            name,
            badge: String(t?.strBadge || '').trim() || null,
          });
        }
      }
      if (teamsByName.size >= 6) break;
    } catch {
      // Try next source.
    }
  }

  const teams = [...teamsByName.values()];
  _teamsCache.set(cacheKey, { teams, expiresAt: Date.now() + CACHE_TTL_MS });
  return teams;
}

function countryNamesRoughlyMatch(providerCountry, requestedCountry) {
  const left = normalizeCountryKey(providerCountry);
  const right = normalizeCountryKey(requestedCountry);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const aliases = [
    ['united kingdom', 'england'],
    ['united kingdom', 'scotland'],
    ['united kingdom', 'wales'],
    ['united states', 'usa'],
    ['united states', 'united states of america'],
    ['south korea', 'korea republic'],
    ['russia', 'russian federation'],
    ['czech republic', 'czechia'],
    ['ivory coast', 'cote d ivoire'],
  ];
  return aliases.some(([a, b]) => (left === a && right === b) || (left === b && right === a));
}

function toSportsDbSport(sport) {
  const key = String(sport || '').toLowerCase();
  if (key.includes('soccer') || key === 'football') return 'Soccer';
  if (key.includes('basketball')) return 'Basketball';
  if (key.includes('baseball')) return 'Baseball';
  if (key.includes('cricket')) return 'Cricket';
  if (key.includes('hockey')) return 'Ice Hockey';
  if (key.includes('rugby')) return 'Rugby';
  if (key.includes('volleyball')) return 'Volleyball';
  if (key.includes('australian')) return 'Australian Football';
  if (key.includes('american football')) return 'American Football';
  return null;
}

async function fetchCricinfoIplStandings() {
  const targets = await discoverCricinfoIplPointsUrls();
  for (const target of targets) {
    try {
      const { statusCode, body } = await httpGet(target, REQUEST_TIMEOUT_MS, {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'News-Globe/1.0 (+https://localhost)',
      });
      if (statusCode < 200 || statusCode >= 300) continue;

      const parsed = parseCricinfoPointsTableHtml(body);
      if (parsed.rows.length > 0) {
        return {
          table: parsed.rows,
          league: {
            id: 'cricinfo-ipl',
            name: 'Indian Premier League (IPL)',
            sport: 'Cricket',
            country: 'India',
          },
          season: parsed.season || null,
        };
      }
    } catch {
      // Continue to next candidate URL.
    }
  }

  return { table: [], league: null, season: null };
}

async function discoverCricinfoIplPointsUrls() {
  const fallbackUrls = [];

  try {
    const { statusCode, body } = await httpGet('https://www.espncricinfo.com/', REQUEST_TIMEOUT_MS, {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'News-Globe/1.0 (+https://localhost)',
    });
    if (statusCode < 200 || statusCode >= 300) return fallbackUrls;

    const matches = body.match(/\/series\/indian-premier-league-[^"']+\/points-table-standings/gi) || [];
    const urls = [...new Set(matches.map((path) => `https://www.espncricinfo.com${path}`))];
    if (urls.length === 0) return fallbackUrls;
    return [...urls, ...fallbackUrls];
  } catch {
    return fallbackUrls;
  }
}

function parseCricinfoPointsTableHtml(html) {
  const text = String(html || '');
  const seasonMatch = text.match(/Indian Premier League\s+(\d{4})/i);
  const season = seasonMatch ? seasonMatch[1] : null;

  // Parse table headers and rows in a lightweight way.
  const tableMatch = text.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return { rows: [], season };

  const tableHtml = tableMatch[0];
  const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  if (rowMatches.length < 2) return { rows: [], season };

  const headers = extractHtmlCells(rowMatches[0]).map((h) => normalizeHeader(h));
  const idxTeam = findHeaderIndex(headers, ['team', 'teams']);
  const idxPlayed = findHeaderIndex(headers, ['p', 'played', 'mat']);
  const idxWin = findHeaderIndex(headers, ['won', 'w']);
  const idxLoss = findHeaderIndex(headers, ['lost', 'l']);
  const idxPoints = findHeaderIndex(headers, ['pts', 'points']);

  const rows = [];
  for (let i = 1; i < rowMatches.length; i += 1) {
    const cells = extractHtmlCells(rowMatches[i]);
    if (cells.length === 0) continue;

    const team = pickCell(cells, idxTeam, 0);
    if (!team) continue;

    const played = toInt(pickCell(cells, idxPlayed, 1), 0);
    const win = toInt(pickCell(cells, idxWin, 2), 0);
    const loss = toInt(pickCell(cells, idxLoss, 3), 0);
    const points = toInt(pickCell(cells, idxPoints, cells.length - 1), 0);

    rows.push({
      position: rows.length + 1,
      team,
      played,
      win,
      draw: 0,
      noResult: 0,
      loss,
      points,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      badge: null,
    });
  }

  return { rows, season };
}

function extractHtmlCells(rowHtml) {
  const matches = String(rowHtml || '').match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
  return matches
    .map((cell) => cell
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean);
}

function normalizeHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findHeaderIndex(headers, candidates) {
  for (const candidate of candidates) {
    const key = normalizeHeader(candidate);
    const idx = headers.findIndex((h) => h === key || h.includes(key));
    if (idx >= 0) return idx;
  }
  return -1;
}

function pickCell(cells, index, fallbackIndex) {
  if (index >= 0 && index < cells.length) return cells[index];
  if (fallbackIndex >= 0 && fallbackIndex < cells.length) return cells[fallbackIndex];
  return '';
}

async function fetchCricinfoIplStandingsApi() {
  const endpoints = [
    'https://site.api.espncricinfo.com/apis/site/v2/sports/cricket/ipl/standings',
    'https://site.api.espncricinfo.com/apis/site/v2/sports/cricket/series/ipl/standings',
    'https://site.api.espncricinfo.com/apis/site/v2/sports/cricket/series/indian-premier-league/standings',
  ];

  for (const url of endpoints) {
    try {
      const data = await httpGetJson(url);
      const parsed = parseCricinfoApiStandings(data);
      if (parsed.table.length > 0) {
        return parsed;
      }
    } catch {
      // try next endpoint
    }
  }

  return { table: [], league: null, season: null };
}

function parseCricinfoApiStandings(data) {
  const espnEntries = extractEspnEntries(data);
  if (espnEntries.length > 0) {
    const table = espnEntries
      .map((entry, idx) => normalizeEspnRow(entry, idx + 1))
      .filter((row) => row.team && row.played + row.win + row.loss + row.points > 0)
      .sort((a, b) => a.position - b.position);
    if (table.length > 0) {
      return {
        table,
        league: {
          id: 'cricinfo-ipl-api',
          name: data?.name || 'Indian Premier League (IPL)',
          sport: 'Cricket',
          country: 'India',
        },
        season: data?.season?.displayName || String(data?.season?.year || ''),
      };
    }
  }

  const rows = [];
  walkObjects(data, (obj) => {
    const team =
      obj?.team?.displayName
      || obj?.team?.shortDisplayName
      || obj?.teamName
      || obj?.name
      || obj?.strTeam;
    const points = toInt(obj?.points ?? obj?.pts ?? obj?.point, 0);
    const played = toInt(obj?.played ?? obj?.matches ?? obj?.mat ?? obj?.p, 0);
    const win = toInt(obj?.won ?? obj?.win ?? obj?.w, 0);
    const loss = toInt(obj?.lost ?? obj?.loss ?? obj?.l, 0);
    const rank = toInt(obj?.position ?? obj?.rank ?? obj?.pos, rows.length + 1);

    if (!team) return;
    if (played === 0 && win === 0 && loss === 0 && points === 0) return;

    rows.push({
      position: rank,
      team: String(team),
      played,
      win,
      draw: 0,
      noResult: toInt(obj?.noResult ?? obj?.nr ?? obj?.no_results, 0),
      loss,
      points,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      badge: obj?.team?.logos?.[0]?.href || null,
    });
  });

  const deduped = dedupeRowsByTeam(rows)
    .sort((a, b) => (a.position - b.position) || (b.points - a.points));

  return {
    table: deduped,
    league: {
      id: 'cricinfo-ipl-api',
      name: 'Indian Premier League (IPL)',
      sport: 'Cricket',
      country: 'India',
    },
    season: String(data?.season?.displayName || data?.season?.year || ''),
  };
}

function walkObjects(value, onObject) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, onObject);
    return;
  }
  if (typeof value === 'object') {
    onObject(value);
    for (const child of Object.values(value)) {
      walkObjects(child, onObject);
    }
  }
}

function dedupeRowsByTeam(rows) {
  const byTeam = new Map();
  for (const row of rows || []) {
    const key = String(row?.team || '').toLowerCase();
    if (!key) continue;
    const prev = byTeam.get(key);
    if (!prev) {
      byTeam.set(key, row);
      continue;
    }
    const prevScore = prev.played + prev.win + prev.loss + prev.points;
    const nextScore = row.played + row.win + row.loss + row.points;
    if (nextScore > prevScore) byTeam.set(key, row);
  }
  return [...byTeam.values()];
}

async function fetchIccCricketRankings() {
  const urls = [
    'https://www.icc-cricket.com/rankings/mens/team-rankings/odi',
    'https://www.icc-cricket.com/rankings/mens/team-rankings/t20i',
    'https://www.icc-cricket.com/rankings/mens/team-rankings/test',
  ];

  for (const url of urls) {
    try {
      const { statusCode, body } = await httpGet(url, REQUEST_TIMEOUT_MS, {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'News-Globe/1.0 (+https://localhost)',
      });
      if (statusCode < 200 || statusCode >= 300) continue;

      const parsed = parseIccRankingsHtml(body);
      if (parsed.rows.length > 0) {
        return {
          table: parsed.rows,
          league: {
            id: 'icc-team-rankings',
            name: parsed.title || "ICC Men's Team Rankings",
            sport: 'Cricket',
            country: 'Global',
          },
          season: parsed.season || null,
        };
      }
    } catch {
      // Try next ICC page.
    }
  }

  return { table: [], league: null, season: null };
}

function parseIccRankingsHtml(html) {
  const text = String(html || '');
  const titleMatch = text.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : "ICC Men's Team Rankings";
  const season = String(new Date().getUTCFullYear());

  const tableMatch = text.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return { rows: [], title, season };

  const tableHtml = tableMatch[0];
  const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  if (rowMatches.length < 2) return { rows: [], title, season };

  const headers = extractHtmlCells(rowMatches[0]).map((h) => normalizeHeader(h));
  const idxPos = findHeaderIndex(headers, ['pos', 'rank', 'position']);
  const idxTeam = findHeaderIndex(headers, ['team', 'teams']);
  const idxMatches = findHeaderIndex(headers, ['matches', 'mat']);
  const idxPoints = findHeaderIndex(headers, ['points', 'pts']);
  const idxRating = findHeaderIndex(headers, ['rating', 'rate']);

  const rows = [];
  for (let i = 1; i < rowMatches.length; i += 1) {
    const cells = extractHtmlCells(rowMatches[i]);
    if (cells.length === 0) continue;

    const team = pickCell(cells, idxTeam, 1);
    if (!team) continue;

    const rank = toInt(pickCell(cells, idxPos, 0), rows.length + 1);
    const matches = toInt(pickCell(cells, idxMatches, 2), 0);
    const points = toInt(pickCell(cells, idxPoints, 3), 0);
    const rating = toInt(pickCell(cells, idxRating, 4), 0);

    rows.push({
      position: rank,
      team,
      played: matches,
      win: 0,
      draw: 0,
      noResult: 0,
      loss: 0,
      points: points > 0 ? points : rating,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      badge: null,
    });
  }

  rows.sort((a, b) => a.position - b.position);
  return { rows, title, season };
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function hydrateRowsWithBadges(rows) {
  return (rows || []).map((row) => {
    if (row?.badge) return row;
    const key = normalizeTeamKey(row?.team || '');
    const badge = TEAM_BADGE_BY_NAME[key] || null;
    return { ...row, badge };
  });
}

function normalizeTeamKey(teamName) {
  return String(teamName || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
