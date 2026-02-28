/**
 * Country Code Mapping Utility
 *
 * Maps country names (from world-atlas TopoJSON) to ISO 3166-1 alpha-2 codes
 * required by NewsAPI's top-headlines endpoint and WorldNewsAPI.
 *
 * Note: NewsAPI only supports a subset of countries for top-headlines.
 * WorldNewsAPI supports 200+ countries for top news.
 * Supported countries include: ae, ar, at, au, be, bg, br, ca, ch, cn, co, cu, cz,
 * de, eg, fr, gb, gr, hk, hu, id, ie, il, in, it, jp, kr, lt, lv, ma, mx,
 * my, ng, nl, no, nz, ph, pl, pt, ro, rs, ru, sa, se, sg, si, sk, th, tr,
 * tw, ua, us, ve, za, and many more via WorldNewsAPI
 */

// Comprehensive mapping of country names to ISO codes
const COUNTRY_NAME_TO_CODE = {
  // A
  'Afghanistan': 'af',
  'Albania': 'al',
  'Algeria': 'dz',
  'Argentina': 'ar',
  'Australia': 'au',
  'Austria': 'at',
  'Azerbaijan': 'az',

  // B
  'Bangladesh': 'bd',
  'Belarus': 'by',
  'Belgium': 'be',
  'Bolivia': 'bo',
  'Bosnia and Herz.': 'ba',
  'Bosnia and Herzegovina': 'ba',
  'Brazil': 'br',
  'Bulgaria': 'bg',

  // C
  'Cambodia': 'kh',
  'Canada': 'ca',
  'Chile': 'cl',
  'China': 'cn',
  'Colombia': 'co',
  'Costa Rica': 'cr',
  'Croatia': 'hr',
  'Cuba': 'cu',
  'Cyprus': 'cy',
  'Czech Rep.': 'cz',
  'Czechia': 'cz',
  'Czech Republic': 'cz',

  // D
  'Denmark': 'dk',
  'Dominican Rep.': 'do',
  'Dominican Republic': 'do',

  // E
  'Ecuador': 'ec',
  'Egypt': 'eg',
  'El Salvador': 'sv',
  'Estonia': 'ee',
  'Ethiopia': 'et',

  // F
  'Finland': 'fi',
  'France': 'fr',

  // G
  'Germany': 'de',
  'Ghana': 'gh',
  'Greece': 'gr',
  'Guatemala': 'gt',

  // H
  'Honduras': 'hn',
  'Hong Kong': 'hk',
  'Hungary': 'hu',

  // I
  'Iceland': 'is',
  'India': 'in',
  'Indonesia': 'id',
  'Iran': 'ir',
  'Iraq': 'iq',
  'Ireland': 'ie',
  'Israel': 'il',
  'Italy': 'it',

  // J
  'Jamaica': 'jm',
  'Japan': 'jp',
  'Jordan': 'jo',

  // K
  'Kazakhstan': 'kz',
  'Kenya': 'ke',
  'Kuwait': 'kw',

  // L
  'Latvia': 'lv',
  'Lebanon': 'lb',
  'Libya': 'ly',
  'Lithuania': 'lt',
  'Luxembourg': 'lu',

  // M
  'Malaysia': 'my',
  'Mexico': 'mx',
  'Morocco': 'ma',
  'Myanmar': 'mm',

  // N
  'Nepal': 'np',
  'Netherlands': 'nl',
  'New Zealand': 'nz',
  'Nicaragua': 'ni',
  'Nigeria': 'ng',
  'North Korea': 'kp',
  'Norway': 'no',

  // O
  'Oman': 'om',

  // P
  'Pakistan': 'pk',
  'Panama': 'pa',
  'Paraguay': 'py',
  'Peru': 'pe',
  'Philippines': 'ph',
  'Poland': 'pl',
  'Portugal': 'pt',

  // Q
  'Qatar': 'qa',

  // R
  'Romania': 'ro',
  'Russia': 'ru',

  // S
  'Saudi Arabia': 'sa',
  'Serbia': 'rs',
  'Singapore': 'sg',
  'Slovakia': 'sk',
  'Slovenia': 'si',
  'South Africa': 'za',
  'South Korea': 'kr',
  'Spain': 'es',
  'Sri Lanka': 'lk',
  'Sudan': 'sd',
  'Sweden': 'se',
  'Switzerland': 'ch',
  'Syria': 'sy',

  // T
  'Taiwan': 'tw',
  'Tanzania': 'tz',
  'Thailand': 'th',
  'Tunisia': 'tn',
  'Turkey': 'tr',
  'Türkiye': 'tr',

  // U
  'Uganda': 'ug',
  'Ukraine': 'ua',
  'United Arab Emirates': 'ae',
  'United Kingdom': 'gb',
  'United States': 'us',
  'United States of America': 'us',
  'Uruguay': 'uy',
  'Uzbekistan': 'uz',

  // V
  'Venezuela': 've',
  'Vietnam': 'vn',

  // Y
  'Yemen': 'ye',

  // Z
  'Zimbabwe': 'zw',
  'Zambia': 'zm',
};

// Countries supported by NewsAPI top-headlines endpoint and WorldNewsAPI
const NEWSAPI_SUPPORTED_COUNTRIES = new Set([
  // NewsAPI supported countries (higher quality)
  'ae', 'ar', 'at', 'au', 'be', 'bg', 'br', 'ca', 'ch', 'cn', 'co', 'cu', 'cz',
  'de', 'eg', 'fr', 'gb', 'gr', 'hk', 'hu', 'id', 'ie', 'il', 'in', 'it', 'jp',
  'kr', 'lt', 'lv', 'ma', 'mx', 'my', 'ng', 'nl', 'no', 'nz', 'ph', 'pl', 'pt',
  'ro', 'rs', 'ru', 'sa', 'se', 'sg', 'si', 'sk', 'th', 'tr', 'tw', 'ua', 'us',
  've', 'za',
  // Additional WorldNewsAPI supported countries
  'ad', 'af', 'ai', 'al', 'am', 'ao', 'aw', 'az', 'ba', 'bb', 'bf', 'bh', 'bi',
  'bj', 'bm', 'bn', 'bo', 'bs', 'bw', 'by', 'bz', 'cf', 'cg', 'cl', 'cm', 'cr',
  'cv', 'cy', 'dj', 'dk', 'do', 'dz', 'ec', 'ee', 'er', 'es', 'et', 'eu', 'fi',
  'fj', 'fo', 'ga', 'ge', 'gf', 'gg', 'gh', 'gm', 'gn', 'gt', 'gw', 'gy', 'hn',
  'hr', 'ht', 'im', 'io', 'iq', 'ir', 'is', 'jm', 'jo', 'ke', 'kg', 'kh', 'kp',
  'kw', 'ky', 'kz', 'la', 'lb', 'lk', 'lr', 'lu', 'ly', 'mc', 'md', 'me', 'mg',
  'mk', 'mm', 'mn', 'mo', 'mp', 'mr', 'mt', 'mw', 'mz', 'na', 'ne', 'ni', 'np',
  'pa', 'pe', 'pf', 'pg', 'pk', 'pr', 'ps', 'py', 'qa', 're', 'rw', 'sb', 'sd',
  'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st', 'sv', 'sz', 'td', 'tg', 'tj', 'tl',
  'tm', 'tn', 'tt', 'tv', 'tz', 'ug', 'uy', 'uz', 'va', 'vc', 'vi', 'vn', 'vu',
  'xk', 'ye', 'yt', 'zm', 'zw'
]);

/**
 * Gets the ISO 3166-1 alpha-2 country code for a country name
 *
 * @param {string} countryName - Full country name (e.g., "United States")
 * @returns {string|null} ISO code (e.g., "us") or null if not found
 */
export function getCountryCode(countryName) {
  if (!countryName) return null;

  // Direct lookup
  const code = COUNTRY_NAME_TO_CODE[countryName];
  if (code) return code;

  // Try case-insensitive lookup
  const lowerName = countryName.toLowerCase();
  for (const [name, isoCode] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (name.toLowerCase() === lowerName) {
      return isoCode;
    }
  }

  // Try partial match (for variations in naming)
  for (const [name, isoCode] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (name.toLowerCase().includes(lowerName) || lowerName.includes(name.toLowerCase())) {
      return isoCode;
    }
  }

  return null;
}

/**
 * Checks if a country is supported by GDELT (all countries with a known code are supported).
 *
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {boolean} True if the country has a mapped ISO code
 */
export function isGdeltSupported(countryCode) {
  if (!countryCode) return false;
  return countryCode.length === 2; // GDELT covers all countries globally
}

/** @deprecated Use isGdeltSupported instead */
export function isNewsApiSupported(countryCode) {
  return isGdeltSupported(countryCode);
}

/**
 * Gets country info including code and API support status
 *
 * @param {string} countryName - Full country name
 * @returns {{code: string|null, name: string, supported: boolean}}
 */
export function getCountryInfo(countryName) {
  const code = getCountryCode(countryName);
  return {
    code,
    name: countryName,
    supported: code ? isNewsApiSupported(code) : false,
  };
}

/**
 * Gets all supported country names
 * @returns {string[]} Array of country names supported by NewsAPI or WorldNewsAPI
 */
export function getSupportedCountries() {
  return Object.entries(COUNTRY_NAME_TO_CODE)
    .filter(([, code]) => NEWSAPI_SUPPORTED_COUNTRIES.has(code))
    .map(([name]) => name)
    .sort();
}
