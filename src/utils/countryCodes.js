/**
 * Country Code Mapping Utility
 *
 * Maps country names (from world-atlas TopoJSON) to ISO 3166-1 alpha-2 codes
 * required by NewsAPI's top-headlines endpoint.
 *
 * Note: NewsAPI only supports a subset of countries for top-headlines.
 * Supported countries: ae, ar, at, au, be, bg, br, ca, ch, cn, co, cu, cz,
 * de, eg, fr, gb, gr, hk, hu, id, ie, il, in, it, jp, kr, lt, lv, ma, mx,
 * my, ng, nl, no, nz, ph, pl, pt, ro, rs, ru, sa, se, sg, si, sk, th, tr,
 * tw, ua, us, ve, za
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

// Countries supported by NewsAPI top-headlines endpoint
const NEWSAPI_SUPPORTED_COUNTRIES = new Set([
  'ae', 'ar', 'at', 'au', 'be', 'bg', 'br', 'ca', 'ch', 'cn', 'co', 'cu', 'cz',
  'de', 'eg', 'fr', 'gb', 'gr', 'hk', 'hu', 'id', 'ie', 'il', 'in', 'it', 'jp',
  'kr', 'lt', 'lv', 'ma', 'mx', 'my', 'ng', 'nl', 'no', 'nz', 'ph', 'pl', 'pt',
  'ro', 'rs', 'ru', 'sa', 'se', 'sg', 'si', 'sk', 'th', 'tr', 'tw', 'ua', 'us',
  've', 'za'
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
 * Checks if a country is supported by NewsAPI's top-headlines endpoint
 *
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {boolean} True if supported
 */
export function isNewsApiSupported(countryCode) {
  if (!countryCode) return false;
  return NEWSAPI_SUPPORTED_COUNTRIES.has(countryCode.toLowerCase());
}

/**
 * Gets country info including code and NewsAPI support status
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
 * @returns {string[]} Array of country names supported by NewsAPI
 */
export function getSupportedCountries() {
  return Object.entries(COUNTRY_NAME_TO_CODE)
    .filter(([, code]) => NEWSAPI_SUPPORTED_COUNTRIES.has(code))
    .map(([name]) => name)
    .sort();
}
