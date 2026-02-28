/**
 * useCountryInfo — fetches structured country data from free APIs.
 *
 * Sources:
 *   REST Countries  (https://restcountries.com)         — no key
 *   World Bank API  (https://api.worldbank.org)          — no key
 *   API Ninjas      (https://api-ninjas.com/api/country) — VITE_API_NINJAS_KEY required
 *
 * API Ninjas /v1/country returns numeric stats only — no text fields for
 * ethnic groups, religion, government type, head of state, etc.
 */

import { useState, useEffect } from 'react';

const WB       = 'https://api.worldbank.org/v2/country';
const RC_ALPHA = 'https://restcountries.com/v3.1/alpha';
const RC_NAME  = 'https://restcountries.com/v3.1/name';

/** Resolve an ISO-2 code when getCountryCode() returned null (obscure countries). */
async function resolveCodeByName(name) {
  try {
    const res = await fetch(
      `${RC_NAME}/${encodeURIComponent(name)}?fullText=true&fields=cca2`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0]?.cca2?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

// ── API Ninjas helper ───────────────────────────────────

const AN = 'https://api.api-ninjas.com/v1/country';

async function fetchApiNinjas(name) {
  const key = import.meta.env.VITE_API_NINJAS_KEY;
  if (!key || !name) return null;
  try {
    const res = await fetch(`${AN}?name=${encodeURIComponent(name)}`, {
      headers: { 'X-Api-Key': key },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

// ── World Bank helpers ──────────────────────────────────

/** Fetch a single WB indicator; return { value, year } of the most-recent non-null record. */
async function wbLatest(iso2, indicator) {
  try {
    const res = await fetch(
      `${WB}/${iso2}/indicator/${indicator}?format=json&mrv=5&per_page=5`
    );
    if (!res.ok) return null;
    const [, records] = await res.json();
    const hit = (records ?? []).find(r => r.value !== null);
    return hit ? { value: hit.value, year: hit.date } : null;
  } catch {
    return null;
  }
}

/** Fetch a WB time series; returns array of { year, value } sorted oldest → newest. */
async function wbSeries(iso2, indicator, years = 10) {
  try {
    const res = await fetch(
      `${WB}/${iso2}/indicator/${indicator}?format=json&mrv=${years}&per_page=${years}`
    );
    if (!res.ok) return [];
    const [, records] = await res.json();
    return (records ?? [])
      .filter(r => r.value !== null)
      .map(r => ({ year: r.date, value: r.value }))
      .reverse(); // WB returns newest-first
  } catch {
    return [];
  }
}

/** Parse API Ninjas numeric strings safely. */
function anNum(val) {
  if (val == null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// ── Main hook ───────────────────────────────────────────

export function useCountryInfo(countryCode, countryName) {
  const [info,      setInfo]      = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    if (!countryCode && !countryName) { setInfo(null); return; }

    setIsLoading(true);
    setInfo(null);
    setError(null);

    (async () => {
      // Resolve ISO-2 code: use provided code, or fall back to name-search
      let iso2 = countryCode?.toUpperCase();
      if (!iso2 || iso2 === '-99' || iso2 === 'XX') {
        const resolved = await resolveCodeByName(countryName);
        if (!resolved) { setInfo({}); return; }
        iso2 = resolved.toUpperCase();
      }

      const RC = `${RC_ALPHA}/${iso2}?fields=name,capital,languages,currencies,population,area,borders,timezones,idd,car,landlocked,region,subregion`;

      // Phase 1: REST Countries first — gives us the clean common name for API Ninjas
      const rc = await fetch(RC).then(r => r.ok ? r.json() : null).catch(() => null);
      const lookupName = rc?.name?.common ?? countryName;

      // Phase 2: World Bank + API Ninjas in parallel
      const [
        // Demographics
        pop, density, lifeExp, birthRate, deathRate, fertility, urban, migration,
        // Economy
        gdpRaw, gdpPcRaw, unemployment, inflation, poverty,
        // Health
        infantMort, hospBeds, physicians, eduExp, literacy, schoolLife,
        // Environment
        electricity, renewable, co2, protectedLand,
        // Time series
        popSeries, gdpPcSeries,
        // API Ninjas
        an,
      ] = await Promise.all([
        // World Bank latest
        wbLatest(iso2, 'SP.POP.TOTL'),
        wbLatest(iso2, 'EN.POP.DNST'),
        wbLatest(iso2, 'SP.DYN.LE00.IN'),
        wbLatest(iso2, 'SP.DYN.CBRT.IN'),
        wbLatest(iso2, 'SP.DYN.CDRT.IN'),
        wbLatest(iso2, 'SP.DYN.TFRT.IN'),
        wbLatest(iso2, 'SP.URB.TOTL.IN.ZS'),
        wbLatest(iso2, 'SM.POP.NETM'),
        wbLatest(iso2, 'NY.GDP.MKTP.CD'),
        wbLatest(iso2, 'NY.GDP.PCAP.CD'),
        wbLatest(iso2, 'SL.UEM.TOTL.ZS'),
        wbLatest(iso2, 'FP.CPI.TOTL.ZG'),
        wbLatest(iso2, 'SI.POV.DDAY'),
        wbLatest(iso2, 'SH.DYN.NMRT'),
        wbLatest(iso2, 'SH.MED.BEDS.ZS'),
        wbLatest(iso2, 'SH.MED.PHYS.ZS'),
        wbLatest(iso2, 'SE.XPD.TOTL.GD.ZS'),
        wbLatest(iso2, 'SE.ADT.LITR.ZS'),
        wbLatest(iso2, 'SE.SCH.LIFE'),
        wbLatest(iso2, 'EG.ELC.ACCS.ZS'),
        wbLatest(iso2, 'EG.FEC.RNEW.ZS'),
        wbLatest(iso2, 'EN.ATM.CO2E.PC'),
        wbLatest(iso2, 'ER.LND.PTLD.ZS'),
        // Time series
        wbSeries(iso2, 'SP.POP.TOTL',   10),
        wbSeries(iso2, 'NY.GDP.PCAP.CD', 10),
        // API Ninjas — use clean common name (e.g. "United States" not "United States of America")
        fetchApiNinjas(lookupName),
      ]);

      // ── REST Countries normalization ──────────────────
      const languages  = rc?.languages
        ? Object.values(rc.languages).join(', ')
        : null;

      const currencies = rc?.currencies
        ? Object.values(rc.currencies)
            .map(c => `${c.name}${c.symbol ? ` (${c.symbol})` : ''}`)
            .join(', ')
        : null;

      const capital = rc?.capital?.[0] ?? null;

      const borders = rc?.borders != null
        ? (rc.borders.length > 0 ? rc.borders.join(', ') : 'None')
        : null;

      const totalArea = rc?.area != null
        ? `${Number(rc.area).toLocaleString('en-US')} km²`
        : null;

      const timezones = rc?.timezones?.join(', ') ?? null;

      const callingCode = rc?.idd
        ? `${rc.idd.root ?? ''}${(rc.idd.suffixes ?? [])[0] ?? ''}`
        : null;

      const drivingSide = rc?.car?.side
        ? rc.car.side.charAt(0).toUpperCase() + rc.car.side.slice(1)
        : null;

      // Population: prefer WB (more recent), fallback to REST Countries
      const population = pop?.value ?? rc?.population ?? null;
      const populationDensity =
        density?.value ??
        (rc?.population && rc?.area ? rc.population / rc.area : null);

      // ── API Ninjas field extraction ───────────────────
      // All AN numeric fields come back as strings, so parse with anNum()
      const anGdpGrowth      = anNum(an?.gdp_growth);
      const anExports        = anNum(an?.exports);        // millions USD
      const anImports        = anNum(an?.imports);        // millions USD
      const anInternetUsers  = anNum(an?.internet_users); // %
      const anHomicide       = anNum(an?.homicide_rate);  // per 100k
      const anSexRatio       = anNum(an?.sex_ratio);      // males per 100 females
      const anPopGrowth      = anNum(an?.pop_growth);     // %
      const anTourists       = anNum(an?.tourists);       // thousands
      const anRefugees       = anNum(an?.refugees);       // per 100k
      const anThreatened     = anNum(an?.threatened_species);
      const anForested       = anNum(an?.forested_area);  // %
      const anLifeM          = anNum(an?.life_expectancy_male);
      const anLifeF          = anNum(an?.life_expectancy_female);
      const anEmpServices    = anNum(an?.employment_services);    // %
      const anEmpIndustry    = anNum(an?.employment_industry);    // %
      const anEmpAgriculture = anNum(an?.employment_agriculture); // %

      setInfo({
        // ── Demographics ──────────────────────────────
        population:        population != null ? fmtPop(population) : null,
        populationDensity: populationDensity != null ? `${fmtNum(populationDensity, 1)} / km²` : null,
        popGrowth:         anPopGrowth  != null ? `${fmtNum(anPopGrowth, 1)}% / yr`                    : null,
        sexRatio:          anSexRatio   != null ? `${fmtNum(anSexRatio, 1)} males per 100 females`     : null,
        lifeExpectancy:    lifeExp      ? `${fmtNum(lifeExp.value,   1)} years (${lifeExp.year})`       : null,
        lifeExpMale:       anLifeM      != null ? `${fmtNum(anLifeM,   1)} years`                      : null,
        lifeExpFemale:     anLifeF      != null ? `${fmtNum(anLifeF,   1)} years`                      : null,
        birthRate:         birthRate    ? `${fmtNum(birthRate.value, 1)} / 1,000 (${birthRate.year})`  : null,
        deathRate:         deathRate    ? `${fmtNum(deathRate.value, 1)} / 1,000 (${deathRate.year})`  : null,
        fertilityRate:     fertility    ? `${fmtNum(fertility.value, 2)} births/woman (${fertility.year})` : null,
        urbanizationPct:   urban?.value ?? null,
        urbanizationLabel: urban        ? `${fmtNum(urban.value, 1)}% (${urban.year})`                 : null,
        migrationBalance:  migration
          ? `${migration.value >= 0 ? '+' : ''}${fmtNum(migration.value, 0)} / yr (${migration.year})`
          : null,
        popSeries: popSeries.length >= 3 ? popSeries : null,

        // ── Languages & Education ─────────────────────
        languages,
        literacyPct:   literacy?.value ?? null,
        literacyLabel: literacy ? `${fmtNum(literacy.value, 1)}% (${literacy.year})` : null,
        internetUsers: anInternetUsers != null ? `${fmtNum(anInternetUsers, 1)}%` : null,

        // ── Economy ───────────────────────────────────
        gdp:           gdpRaw   ? `${fmtGdp(gdpRaw.value)} (${gdpRaw.year})`                          : null,
        gdpPerCapita:  gdpPcRaw ? `$${fmtNum(gdpPcRaw.value, 0)} (${gdpPcRaw.year})`                  : null,
        gdpGrowth:     anGdpGrowth  != null ? `${fmtNum(anGdpGrowth, 1)}%`                            : null,
        currency:      currencies,
        unemployment:  unemployment ? `${fmtNum(unemployment.value, 1)}% (${unemployment.year})`       : null,
        inflation:     inflation    ? `${fmtNum(inflation.value,    1)}% (${inflation.year})`           : null,
        povertyRate:   poverty      ? `${fmtNum(poverty.value,      1)}% at $2.15/day (${poverty.year})` : null,
        exports:       anExports    != null ? fmtGdp(anExports * 1e6)                                 : null,
        imports:       anImports    != null ? fmtGdp(anImports * 1e6)                                 : null,
        empServices:   anEmpServices    != null ? `${fmtNum(anEmpServices,    1)}%` : null,
        empIndustry:   anEmpIndustry    != null ? `${fmtNum(anEmpIndustry,    1)}%` : null,
        empAgriculture:anEmpAgriculture != null ? `${fmtNum(anEmpAgriculture, 1)}%` : null,
        gdpPcSeries:   gdpPcSeries.length >= 3 ? gdpPcSeries : null,

        // ── Government ────────────────────────────────
        capital,
        region: rc?.subregion ?? rc?.region ?? null,

        // ── Geography ─────────────────────────────────
        totalArea,
        borders,
        landlocked:   rc?.landlocked != null ? (rc.landlocked ? 'Yes' : 'No') : null,
        forestedArea: anForested != null ? `${fmtNum(anForested, 1)}% of land` : null,

        // ── Social & Health ───────────────────────────
        infantMortality:      infantMort ? `${fmtNum(infantMort.value,  1)} / 1,000 live births (${infantMort.year})` : null,
        hospitalBeds:         hospBeds   ? `${fmtNum(hospBeds.value,    2)} / 1,000 (${hospBeds.year})`               : null,
        physicians:           physicians ? `${fmtNum(physicians.value,  2)} / 1,000 (${physicians.year})`             : null,
        educationExpenditure: eduExp     ? `${fmtNum(eduExp.value,      1)}% of GDP (${eduExp.year})`                 : null,
        schoolLifeExpectancy: schoolLife ? `${fmtNum(schoolLife.value,  1)} years (${schoolLife.year})`               : null,
        homicideRate:    anHomicide  != null ? `${fmtNum(anHomicide,  1)} / 100,000` : null,
        touristArrivals: anTourists  != null ? `${fmtNum(anTourists,  0)}K visitors` : null,
        refugees:        anRefugees  != null ? `${fmtNum(anRefugees,  1)} / 100,000` : null,

        // ── Environment & Energy ──────────────────────
        electricityPct:    electricity?.value ?? null,
        electricityLabel:  electricity  ? `${fmtNum(electricity.value,  1)}% (${electricity.year})`  : null,
        renewablePct:      renewable?.value ?? null,
        renewableLabel:    renewable    ? `${fmtNum(renewable.value,    1)}% (${renewable.year})`     : null,
        co2Emissions:      co2          ? `${fmtNum(co2.value,          2)} t/capita (${co2.year})`   : null,
        protectedLand:     protectedLand ? `${fmtNum(protectedLand.value, 1)}% of land (${protectedLand.year})` : null,
        forestedAreaPct:   anForested   != null ? anForested                                          : null,
        threatenedSpecies: anThreatened != null ? fmtNum(anThreatened, 0)                             : null,

        // ── Culture & Misc ────────────────────────────
        timezones,
        callingCode: callingCode || null,
        drivingSide,
      });
    })().catch(err => setError(err.message)).finally(() => setIsLoading(false));
  }, [countryCode]);

  return { info, isLoading, error };
}

// ── Formatters ──────────────────────────────────────────

function fmtNum(n, dec = 0) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtPop(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function fmtGdp(n) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)} T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)} B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)} M`;
  return `$${n}`;
}
