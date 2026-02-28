/**
 * ACLED Local Data Service
 *
 * Parses the two ACLED dashboard export files (xlsx) bundled in server/data/:
 *   • acled_violence_events.xlsx  — COUNTRY | MONTH | YEAR | EVENTS  (monthly)
 *   • acled_fatalities.xlsx        — COUNTRY | YEAR | FATALITIES       (yearly)
 *
 * Used automatically when ACLED_API_KEY / ACLED_EMAIL are not configured.
 *
 * Data as-of: 20 Feb 2026 (ACLED dashboard export)
 * Attribution: "Data: ACLED (Armed Conflict Location & Event Data Project)"
 */
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
import { getConflictIndex } from './acledConflictIndexService.js';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');

// ─── Month helpers ────────────────────────────────────────────────────────────

const MONTH_NUM = {
  January: 1, February: 2, March: 3, April: 4,
  May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12,
};

function toISO(year, month) {
  const m = typeof month === 'string' ? MONTH_NUM[month] : month;
  return `${year}-${String(m).padStart(2, '0')}-01`;
}

function monthBounds(year, month) {
  const monthNum = typeof month === 'string' ? MONTH_NUM[month] : month;
  const start = new Date(Date.UTC(year, monthNum - 1, 1));
  const end = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));
  return { start, end };
}

// ─── Country centroids ────────────────────────────────────────────────────────
// Approximate centroids for map bubble placement.

const CENTROIDS = {
  'Afghanistan': [33.9391, 67.7100], 'Albania': [41.1533, 20.1683],
  'Algeria': [28.0339, 1.6596], 'Angola': [-11.2027, 17.8739],
  'Argentina': [-38.4161, -63.6167], 'Armenia': [40.0691, 45.0382],
  'Australia': [-25.2744, 133.7751], 'Austria': [47.5162, 14.5501],
  'Azerbaijan': [40.1431, 47.5769], 'Bahrain': [26.0275, 50.5500],
  'Bangladesh': [23.6850, 90.3563], 'Belarus': [53.7098, 27.9534],
  'Belgium': [50.5039, 4.4699], 'Benin': [9.3077, 2.3158],
  'Bolivia': [-16.2902, -63.5887], 'Bosnia and Herzegovina': [43.9159, 17.6791],
  'Botswana': [-22.3285, 24.6849], 'Brazil': [-14.2350, -51.9253],
  'Bulgaria': [42.7339, 25.4858], 'Burkina Faso': [12.3642, -1.5275],
  'Burundi': [-3.3731, 29.9189], 'Cambodia': [12.5657, 104.9910],
  'Cameroon': [7.3697, 12.3547], 'Canada': [56.1304, -106.3468],
  'Central African Republic': [6.6111, 20.9394], 'Chad': [15.4542, 18.7322],
  'Chile': [-35.6751, -71.5430], 'China': [35.8617, 104.1954],
  'Colombia': [4.5709, -74.2973], 'Congo': [-0.2280, 15.8277],
  'Democratic Republic of Congo': [-4.0383, 21.7587], 'Costa Rica': [9.7489, -83.7534],
  "Cote d'Ivoire": [7.5400, -5.5471], 'Croatia': [45.1000, 15.2000],
  'Cuba': [21.5218, -77.7812], 'Cyprus': [35.1264, 33.4299],
  'Czech Republic': [49.8175, 15.4730], 'Denmark': [56.2639, 9.5018],
  'Djibouti': [11.8251, 42.5903], 'Ecuador': [-1.8312, -78.1834],
  'Egypt': [26.8206, 30.8025], 'El Salvador': [13.7942, -88.8965],
  'Eritrea': [15.1794, 39.7823], 'Estonia': [58.5953, 25.0136],
  'Ethiopia': [9.1450, 40.4897], 'Finland': [61.9241, 25.7482],
  'France': [46.2276, 2.2137], 'Gabon': [-0.8037, 11.6094],
  'Georgia': [42.3154, 43.3569], 'Germany': [51.1657, 10.4515],
  'Ghana': [7.9465, -1.0232], 'Greece': [39.0742, 21.8243],
  'Guatemala': [15.7835, -90.2308], 'Guinea': [9.9456, -11.3247],
  'Guinea-Bissau': [11.8037, -15.1804], 'Haiti': [18.9712, -72.2852],
  'Honduras': [15.1999, -86.2419], 'Hungary': [47.1625, 19.5033],
  'India': [20.5937, 78.9629], 'Indonesia': [-0.7893, 113.9213],
  'Iran': [32.4279, 53.6880], 'Iraq': [33.2232, 43.6793],
  'Ireland': [53.1424, -7.6921], 'Israel': [31.0461, 34.8516],
  'Italy': [41.8719, 12.5674], 'Jamaica': [18.1096, -77.2975],
  'Japan': [36.2048, 138.2529], 'Jordan': [30.5852, 36.2384],
  'Kazakhstan': [48.0196, 66.9237], 'Kenya': [-0.0236, 37.9062],
  'Kosovo': [42.6026, 20.9030], 'Kuwait': [29.3117, 47.4818],
  'Kyrgyzstan': [41.2044, 74.7661], 'Laos': [19.8563, 102.4955],
  'Lebanon': [33.8547, 35.8623], 'Lesotho': [-29.6100, 28.2336],
  'Liberia': [6.4281, -9.4295], 'Libya': [26.3351, 17.2283],
  'Madagascar': [-18.7669, 46.8691], 'Malawi': [-13.2543, 34.3015],
  'Malaysia': [4.2105, 101.9758], 'Mali': [17.5707, -3.9962],
  'Mauritania': [21.0079, -10.9408], 'Mexico': [23.6345, -102.5528],
  'Moldova': [47.4116, 28.3699], 'Morocco': [31.7917, -7.0926],
  'Mozambique': [-18.6657, 35.5296], 'Myanmar': [21.9162, 95.9560],
  'Namibia': [-22.9576, 18.4904], 'Nepal': [28.3949, 84.1240],
  'Netherlands': [52.1326, 5.2913], 'New Zealand': [-40.9006, 174.8860],
  'Nicaragua': [12.8654, -85.2072], 'Niger': [17.6078, 8.0817],
  'Nigeria': [9.0820, 8.6753], 'North Korea': [40.3399, 127.5101],
  'North Macedonia': [41.6086, 21.7453], 'Norway': [60.4720, 8.4689],
  'Oman': [21.4735, 55.9754], 'Pakistan': [30.3753, 69.3451],
  'Palestine': [31.9522, 35.2332], 'Panama': [8.5380, -80.7821],
  'Papua New Guinea': [-6.3149, 143.9555], 'Paraguay': [-23.4425, -58.4438],
  'Peru': [-9.1899, -75.0152], 'Philippines': [12.8797, 121.7740],
  'Poland': [51.9194, 19.1451], 'Portugal': [39.3999, -8.2245],
  'Romania': [45.9432, 24.9668], 'Russia': [61.5240, 105.3188],
  'Rwanda': [-1.9403, 29.8739], 'Saudi Arabia': [23.8859, 45.0792],
  'Senegal': [14.4974, -14.4524], 'Serbia': [44.0165, 21.0059],
  'Sierra Leone': [8.4606, -11.7799], 'Somalia': [5.1521, 46.1996],
  'South Africa': [-30.5595, 22.9375], 'South Korea': [35.9078, 127.7669],
  'South Sudan': [6.8770, 31.3070], 'Spain': [40.4637, -3.7492],
  'Sri Lanka': [7.8731, 80.7718], 'Sudan': [12.8628, 30.2176],
  'Sweden': [60.1282, 18.6435], 'Switzerland': [46.8182, 8.2275],
  'Syria': [34.8021, 38.9968], 'Taiwan': [23.6978, 120.9605],
  'Tajikistan': [38.8610, 71.2761], 'Tanzania': [-6.3690, 34.8888],
  'Thailand': [15.8700, 100.9925], 'Togo': [8.6195, 0.8248],
  'Trinidad and Tobago': [10.6918, -61.2225], 'Tunisia': [33.8869, 9.5375],
  'Turkey': [38.9637, 35.2433], 'Turkmenistan': [38.9697, 59.5563],
  'Uganda': [1.3733, 32.2903], 'Ukraine': [48.3794, 31.1656],
  'United Arab Emirates': [23.4241, 53.8478],
  'United Kingdom': [55.3781, -3.4360], 'United States': [37.0902, -95.7129],
  'Uruguay': [-32.5228, -55.7658], 'Uzbekistan': [41.3775, 64.5853],
  'Venezuela': [6.4238, -66.5897], 'Vietnam': [14.0583, 108.2772],
  'West Bank and Gaza': [31.9522, 35.2332], 'Western Sahara': [24.2155, -12.8858],
  'Yemen': [15.5527, 48.5164], 'Zambia': [-13.1339, 27.8493],
  'Zimbabwe': [-19.0154, 29.1549],
  // Alternate spellings used by ACLED
  'Ivory Coast': [7.5400, -5.5471], 'eSwatini': [-26.5225, 31.4659],
  'Swaziland': [-26.5225, 31.4659], 'Czechia': [49.8175, 15.4730],
  'DR Congo': [-4.0383, 21.7587], 'DRC': [-4.0383, 21.7587],
  'Republic of the Congo': [-0.2280, 15.8277],
  'Cabo Verde': [15.1200, -23.6050], 'Cape Verde': [15.1200, -23.6050],
  'Timor-Leste': [-8.8742, 125.7275], 'East Timor': [-8.8742, 125.7275],
  'Kosovo (disputed territory)': [42.6026, 20.9030],
  'Nagorno-Karabakh': [39.8500, 46.7500],
};

const DEFAULT_CENTROID = [0, 0]; // fallback for unknown countries

function centroid(country) {
  return CENTROIDS[country] || DEFAULT_CENTROID;
}

// ─── Data loading ─────────────────────────────────────────────────────────────

let _violenceRows = null; // [{ country, month, year, monthNum, events }]
let _fatalRows = null;    // [{ country, year, fatalities }]
// Lookup: country(lower) → year → fatalities
let _fatalMap = null;

function loadOnce() {
  if (_violenceRows) return;

  console.log('[ACLED-Local] Loading xlsx files from server/data/…');

  // ── Violence file ──
  const vwb = XLSX.readFile(resolve(DATA_DIR, 'acled_violence_events.xlsx'));
  const vws = vwb.Sheets[vwb.SheetNames[0]];
  const vraw = XLSX.utils.sheet_to_json(vws, { defval: null });

  _violenceRows = vraw
    .filter((r) => r.COUNTRY && r.MONTH && r.YEAR != null && r.EVENTS != null)
    .map((r) => ({
      country: String(r.COUNTRY).trim(),
      month: String(r.MONTH).trim(),
      monthNum: MONTH_NUM[String(r.MONTH).trim()] || 1,
      year: parseInt(r.YEAR, 10),
      events: parseInt(r.EVENTS, 10) || 0,
    }));

  // ── Fatalities file ──
  const fwb = XLSX.readFile(resolve(DATA_DIR, 'acled_fatalities.xlsx'));
  const fws = fwb.Sheets[fwb.SheetNames[0]];
  const fraw = XLSX.utils.sheet_to_json(fws, { defval: null });

  _fatalRows = fraw
    .filter((r) => r.COUNTRY && r.YEAR != null && r.FATALITIES != null)
    .map((r) => ({
      country: String(r.COUNTRY).trim(),
      year: parseInt(r.YEAR, 10),
      fatalities: parseInt(r.FATALITIES, 10) || 0,
    }));

  // Build fast lookup: lowercase country → year → fatalities
  _fatalMap = {};
  for (const r of _fatalRows) {
    const k = r.country.toLowerCase();
    if (!_fatalMap[k]) _fatalMap[k] = {};
    _fatalMap[k][r.year] = r.fatalities;
  }

  console.log(
    `[ACLED-Local] Loaded ${_violenceRows.length} violence rows, ${_fatalRows.length} fatality rows.`
  );
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Query the local xlsx data, mimicking the shape returned by fetchAcledEvents().
 *
 * @param {object} params
 * @param {string} params.country     Full country name (case-insensitive)
 * @param {string} params.start_date  "YYYY-MM-DD"
 * @param {string} params.end_date    "YYYY-MM-DD"
 * @param {string} [params.event_type] Ignored (only "Political Violence" available)
 * @returns {{ events: object[], total: number, aggregates: object, cached: boolean }}
 */
export function queryLocalAcled(params) {
  loadOnce();

  const { country = '', start_date, end_date } = params;
  const countryLower = country.trim().toLowerCase();
  const isGlobalQuery = !countryLower;

  // Parse date boundaries
  const startD = new Date(start_date);
  const endD = new Date(end_date);

  // Filter violence rows
  const matchingRows = _violenceRows.filter((r) => {
    if (!isGlobalQuery && r.country.toLowerCase() !== countryLower) return false;
    const { start: rowStart, end: rowEnd } = monthBounds(r.year, r.monthNum);
    return rowStart <= endD && rowEnd >= startD;
  });

  if (matchingRows.length === 0) {
    return {
      events: [],
      total: 0,
      cached: false,
      aggregates: { timeline: [], typeBreakdown: [], topActors: [] },
    };
  }

  // ── Build synthetic event records (one per country-month row) ─────────────
  const events = matchingRows.map((r) => {
    const [lat, lng] = centroid(r.country);
    const fatalLookup = _fatalMap[r.country.toLowerCase()] || {};
    const yearlyFat = fatalLookup[r.year] || 0;
    const monthlyFat = Math.round(yearlyFat / 12);

    return {
      event_id: `${r.country}|${r.year}|${r.monthNum}`,
      event_date: toISO(r.year, r.monthNum),
      event_type: 'Political Violence',
      sub_event_type: '',
      actor1: '',
      actor2: '',
      fatalities: monthlyFat,
      location: r.country,
      admin1: '',
      admin2: '',
      country: r.country,
      latitude: lat,
      longitude: lng,
      geo_precision: 1,
      source: 'ACLED Dashboard Export',
      notes: `${r.events.toLocaleString()} political violence events in ${r.month} ${r.year}.`,
      // Extra field for the map/charts to use the real event count
      _event_count: r.events,
      conflictIndex: getConflictIndex(r.country),
    };
  });

  // ── Build aggregates directly from raw data ───────────────────────────────

  // Timeline: one point per month with REAL event count and prorated fatalities
  const timeline = matchingRows
    .map((r) => {
      const fatalLookup = _fatalMap[r.country.toLowerCase()] || {};
      const yearlyFat = fatalLookup[r.year] || 0;
      return {
        date: toISO(r.year, r.monthNum),
        count: r.events,            // actual event count from xlsx
        fatalities: Math.round(yearlyFat / 12),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const collapsedTimeline = Object.values(
    timeline.reduce((acc, row) => {
      if (!acc[row.date]) {
        acc[row.date] = { date: row.date, count: 0, fatalities: 0 };
      }
      acc[row.date].count += row.count;
      acc[row.date].fatalities += row.fatalities;
      return acc;
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date));

  const totalEvents = matchingRows.reduce((s, r) => s + r.events, 0);
  const totalFatalities = collapsedTimeline.reduce((s, r) => s + r.fatalities, 0);

  const typeBreakdown = [
    {
      type: 'Political Violence',
      count: totalEvents,
      fatalities: totalFatalities,
    },
  ];

  return {
    events,
    total: totalEvents,      // sum of EVENTS, not record count
    cached: false,
    aggregates: { timeline: collapsedTimeline, typeBreakdown, topActors: [] },
  };
}

/**
 * Get sorted list of unique countries in the violence dataset.
 * Used by FilterBar suggestions.
 */
export function getLocalCountries() {
  loadOnce();
  return [...new Set(_violenceRows.map((r) => r.country))].sort();
}

/**
 * Check if local data files are present.
 */
export function isLocalDataAvailable() {
  try {
    loadOnce();
    return _violenceRows && _violenceRows.length > 0;
  } catch {
    return false;
  }
}
