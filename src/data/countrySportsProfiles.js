import { getCountryCode } from '../utils/countryCodes';

const SPECIFIC_PROFILES = {
  us: {
    topSport: 'American Football',
    majorLeague: 'NFL',
    seasonWindow: 'September to February',
    notableTeams: ['Kansas City Chiefs', 'Dallas Cowboys', 'San Francisco 49ers'],
  },
  ca: {
    topSport: 'Ice Hockey',
    majorLeague: 'NHL',
    seasonWindow: 'October to June',
    notableTeams: ['Toronto Maple Leafs', 'Montreal Canadiens', 'Edmonton Oilers'],
  },
  gb: {
    topSport: 'Football',
    majorLeague: 'Premier League',
    seasonWindow: 'August to May',
    notableTeams: ['Manchester City', 'Arsenal', 'Liverpool'],
  },
  de: {
    topSport: 'Football',
    majorLeague: 'Bundesliga',
    seasonWindow: 'August to May',
    notableTeams: ['Bayern Munich', 'Borussia Dortmund', 'RB Leipzig'],
  },
  fr: {
    topSport: 'Football',
    majorLeague: 'Ligue 1',
    seasonWindow: 'August to May',
    notableTeams: ['Paris Saint-Germain', 'Marseille', 'Lyon'],
  },
  es: {
    topSport: 'Football',
    majorLeague: 'La Liga',
    seasonWindow: 'August to May',
    notableTeams: ['Real Madrid', 'Barcelona', 'Atletico Madrid'],
  },
  it: {
    topSport: 'Football',
    majorLeague: 'Serie A',
    seasonWindow: 'August to May',
    notableTeams: ['Inter Milan', 'Juventus', 'AC Milan'],
  },
  au: {
    topSport: 'Cricket',
    majorLeague: 'Big Bash League (BBL)',
    seasonWindow: 'December to January',
    notableTeams: ['Perth Scorchers', 'Sydney Sixers', 'Brisbane Heat'],
  },
  nz: {
    topSport: 'Rugby Union',
    majorLeague: 'Super Rugby Pacific',
    seasonWindow: 'February to June',
    notableTeams: ['Crusaders', 'Blues', 'Chiefs'],
  },
  in: {
    topSport: 'Cricket',
    majorLeague: 'Indian Premier League (IPL)',
    seasonWindow: 'March to May',
    notableTeams: ['Mumbai Indians', 'Chennai Super Kings', 'Royal Challengers Bengaluru'],
  },
  pk: {
    topSport: 'Cricket',
    majorLeague: 'Pakistan Super League (PSL)',
    seasonWindow: 'February to March',
    notableTeams: ['Lahore Qalandars', 'Karachi Kings', 'Islamabad United'],
  },
  bd: {
    topSport: 'Cricket',
    majorLeague: 'Bangladesh Premier League (BPL)',
    seasonWindow: 'January to February',
    notableTeams: ['Comilla Victorians', 'Rangpur Riders', 'Dhaka Capitals'],
  },
  jp: {
    topSport: 'Baseball',
    majorLeague: 'Nippon Professional Baseball (NPB)',
    seasonWindow: 'March to October',
    notableTeams: ['Yomiuri Giants', 'Hanshin Tigers', 'Fukuoka SoftBank Hawks'],
  },
  kr: {
    topSport: 'Baseball',
    majorLeague: 'KBO League',
    seasonWindow: 'March to October',
    notableTeams: ['Doosan Bears', 'LG Twins', 'SSG Landers'],
  },
  cn: {
    topSport: 'Basketball',
    majorLeague: 'Chinese Basketball Association (CBA)',
    seasonWindow: 'October to April',
    notableTeams: ['Guangdong Southern Tigers', 'Liaoning Flying Leopards', 'Xinjiang Flying Tigers'],
  },
  ru: {
    topSport: 'Football',
    majorLeague: 'Russian Premier League',
    seasonWindow: 'July to May',
    notableTeams: ['Zenit Saint Petersburg', 'CSKA Moscow', 'Spartak Moscow'],
  },
  br: {
    topSport: 'Football',
    majorLeague: 'Campeonato Brasileiro Serie A',
    seasonWindow: 'April to December',
    notableTeams: ['Flamengo', 'Palmeiras', 'Sao Paulo'],
  },
  ar: {
    topSport: 'Football',
    majorLeague: 'Argentine Primera Division',
    seasonWindow: 'January to December',
    notableTeams: ['River Plate', 'Boca Juniors', 'Racing Club'],
  },
  mx: {
    topSport: 'Football',
    majorLeague: 'Liga MX',
    seasonWindow: 'July to May',
    notableTeams: ['Club America', 'Chivas', 'Monterrey'],
  },
  sa: {
    topSport: 'Football',
    majorLeague: 'Saudi Pro League',
    seasonWindow: 'August to May',
    notableTeams: ['Al Hilal', 'Al Nassr', 'Al Ittihad'],
  },
};

const FOOTBALL_DEFAULT = {
  topSport: 'Football',
  majorLeague: 'Top National Football League',
  seasonWindow: 'Mostly August to May',
  notableTeams: ['Top domestic clubs', 'Leading regional rivals', 'Recent title challengers'],
};

const RUGBY_DEFAULT = {
  topSport: 'Rugby Union',
  majorLeague: 'Top National Rugby League',
  seasonWindow: 'Mostly February to June',
  notableTeams: ['Leading domestic club', 'Top regional contender', 'Defending champion'],
};

const ICE_HOCKEY_DEFAULT = {
  topSport: 'Ice Hockey',
  majorLeague: 'Top National Hockey League',
  seasonWindow: 'Mostly October to April',
  notableTeams: ['Leading domestic team', 'Historic club', 'Current contender'],
};

const CRICKET_DEFAULT = {
  topSport: 'Cricket',
  majorLeague: 'Top Domestic T20 League',
  seasonWindow: 'Varies by country',
  notableTeams: ['Leading franchise', 'Historic side', 'Current contender'],
};

const BASKETBALL_DEFAULT = {
  topSport: 'Basketball',
  majorLeague: 'Top National Basketball League',
  seasonWindow: 'Mostly October to May',
  notableTeams: ['Leading domestic team', 'Major city rival', 'Current contender'],
};

const REGION_DEFAULTS = [
  { codes: new Set(['za', 'ke', 'ug', 'rw']), profile: RUGBY_DEFAULT },
  { codes: new Set(['se', 'fi', 'no', 'is', 'gl']), profile: ICE_HOCKEY_DEFAULT },
  { codes: new Set(['in', 'pk', 'bd', 'lk']), profile: CRICKET_DEFAULT },
  { codes: new Set(['cn', 'ph', 'tw']), profile: BASKETBALL_DEFAULT },
];

function cloneProfile(profile) {
  return {
    topSport: profile.topSport,
    majorLeague: profile.majorLeague,
    seasonWindow: profile.seasonWindow,
    notableTeams: [...profile.notableTeams],
  };
}

export function getCountrySportsProfile(countryName) {
  const code = getCountryCode(countryName);
  if (!code) return null;

  const exact = SPECIFIC_PROFILES[code];
  if (exact) {
    return {
      ...cloneProfile(exact),
      countryCode: code,
      summary: `Most followed sport in ${countryName}: ${exact.topSport}.`,
    };
  }

  for (const entry of REGION_DEFAULTS) {
    if (entry.codes.has(code)) {
      const regional = cloneProfile(entry.profile);
      return {
        ...regional,
        countryCode: code,
        summary: `Most followed sport in ${countryName}: ${regional.topSport}.`,
      };
    }
  }

  const fallback = cloneProfile(FOOTBALL_DEFAULT);
  return {
    ...fallback,
    countryCode: code,
    summary: `Most followed sport in ${countryName}: ${fallback.topSport}.`,
  };
}
