/**
 * CountryInfo — "Info" tab content for a selected country.
 *
 * Data sources:
 *   REST Countries  — languages, currencies, capital, area, borders, timezones, calling code, driving side
 *   World Bank API  — population, GDP, unemployment, health indicators, environment stats
 *   API Ninjas      — GDP growth, exports/imports ($), employment mix, internet users,
 *                     homicide rate, sex ratio, tourists, refugees, threatened species,
 *                     forested area, life expectancy by gender, population growth
 *
 * Note: API Ninjas /v1/country has no text fields for ethnic groups, religion,
 * government type, head of state, climate, elevation, etc.
 */

import { useCountryInfo } from '../hooks/useCountryInfo';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import './CountryInfo.css';

const PLACEHOLDER = '—';

// ── Sub-components ──────────────────────────────────────

function InfoCard({ title, children }) {
  return (
    <div className="cinfo__card">
      <div className="cinfo__card-header">
        <h4 className="cinfo__card-title">{title}</h4>
      </div>
      <div className="cinfo__card-body">{children}</div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="cinfo__stat-row">
      <span className="cinfo__stat-label">{label}</span>
      <span className="cinfo__stat-value">{value ?? PLACEHOLDER}</span>
    </div>
  );
}

/** Stat row with a progress bar underneath. `value` must be 0–100. */
function ProgressRow({ label, displayValue, value, color = '#2a788b' }) {
  const pct = value != null ? Math.min(100, Math.max(0, value)) : null;
  return (
    <div className="cinfo__stat-row cinfo__stat-row--progress">
      <div className="cinfo__stat-row-top">
        <span className="cinfo__stat-label">{label}</span>
        <span className="cinfo__stat-value">{displayValue ?? PLACEHOLDER}</span>
      </div>
      {pct != null && (
        <div className="cinfo__progress-track">
          <div className="cinfo__progress-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

/** Recharts line chart for trend data with visible axes. */
function Sparkline({ data, label, valueFormatter }) {
  if (!data?.length) return null;
  const fmt = valueFormatter ?? (v => v);
  return (
    <div className="cinfo__sparkline">
      {label && <p className="cinfo__sparkline-label">{label}</p>}
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
          <XAxis
            dataKey="year"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmt}
            tickCount={4}
            width={62}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2a788b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#2a788b' }}
          />
          <Tooltip
            formatter={v => [fmt(v), '']}
            labelFormatter={l => l}
            contentStyle={{
              background: 'rgba(8, 12, 22, 0.95)',
              border: '1px solid rgba(42, 120, 139, 0.45)',
              borderRadius: 6,
              fontSize: '0.75rem',
              padding: '4px 10px',
            }}
            itemStyle={{ color: 'rgba(255,255,255,0.85)' }}
            cursor={{ stroke: 'rgba(42,120,139,0.4)', strokeWidth: 1 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main component ──────────────────────────────────────

export default function CountryInfo({ countryName, countryCode }) {
  const { info, isLoading, error } = useCountryInfo(countryCode, countryName);

  if (isLoading) {
    return (
      <div className="cinfo cinfo--loading">
        <div className="cinfo__skeleton" />
        <div className="cinfo__skeleton cinfo__skeleton--short" />
        <div className="cinfo__skeleton" />
      </div>
    );
  }

  if (error) {
    return <div className="cinfo__error">Could not load country data.</div>;
  }

  return (
    <div className="cinfo">

      {/* ── Overview block ───────────────────────────── */}
      <div className="cinfo__overview">
        <div className="cinfo__overview-item">
          <span className="cinfo__overview-label">Capital</span>
          <span className="cinfo__overview-value">{info?.capital ?? PLACEHOLDER}</span>
        </div>
        <div className="cinfo__overview-item">
          <span className="cinfo__overview-label">Population</span>
          <span className="cinfo__overview-value">{info?.population ?? PLACEHOLDER}</span>
        </div>
        <div className="cinfo__overview-item">
          <span className="cinfo__overview-label">Currency</span>
          <span className="cinfo__overview-value">{info?.currency ?? PLACEHOLDER}</span>
        </div>
        <div className="cinfo__overview-item">
          <span className="cinfo__overview-label">Government Type</span>
          <span className="cinfo__overview-value">{PLACEHOLDER}</span>
        </div>
        <div className="cinfo__overview-item">
          <span className="cinfo__overview-label">Head of Government</span>
          <span className="cinfo__overview-value">{PLACEHOLDER}</span>
        </div>
      </div>

      {/* ── Demographics ─────────────────────────────── */}
      <InfoCard title="Demographics">
        <Sparkline
          data={info?.popSeries}
          label="Population trend (10 yr)"
          valueFormatter={v => {
            if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
            if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
            return Math.round(v).toLocaleString();
          }}
        />
        <StatRow label="Population"          value={info?.population} />
        <StatRow label="Population Density"  value={info?.populationDensity} />
        <StatRow label="Population Growth"   value={info?.popGrowth} />
        <StatRow label="Sex Ratio"           value={info?.sexRatio} />
        <StatRow label="Life Expectancy"     value={info?.lifeExpectancy} />
        <StatRow label="Life Exp. — Male"    value={info?.lifeExpMale} />
        <StatRow label="Life Exp. — Female"  value={info?.lifeExpFemale} />
        <StatRow label="Birth Rate"          value={info?.birthRate} />
        <StatRow label="Death Rate"          value={info?.deathRate} />
        <StatRow label="Fertility Rate"      value={info?.fertilityRate} />
        <ProgressRow
          label="Urbanization"
          value={info?.urbanizationPct}
          displayValue={info?.urbanizationLabel}
          color="#76b900"
        />
        <StatRow label="Migration Balance" value={info?.migrationBalance} />
        <StatRow label="Refugees"          value={info?.refugees} />
      </InfoCard>

      {/* ── Languages & Education ─────────────────────── */}
      <InfoCard title="Languages & Education">
        <StatRow label="Official Languages" value={info?.languages} />
        <ProgressRow
          label="Literacy Rate"
          value={info?.literacyPct}
          displayValue={info?.literacyLabel}
          color="#2a788b"
        />
        <StatRow label="Internet Users" value={info?.internetUsers} />
      </InfoCard>

      {/* ── Government ───────────────────────────────── */}
      <InfoCard title="Government">
        <StatRow label="Capital" value={info?.capital} />
        <StatRow label="Region"  value={info?.region} />
      </InfoCard>

      {/* ── Economy ──────────────────────────────────── */}
      <InfoCard title="Economy">
        <Sparkline
          data={info?.gdpPcSeries}
          label="GDP per capita trend (10 yr)"
          valueFormatter={v => `$${Math.round(v).toLocaleString()}`}
        />
        <StatRow label="GDP (Nominal)"            value={info?.gdp} />
        <StatRow label="GDP per Capita"           value={info?.gdpPerCapita} />
        <StatRow label="GDP Growth"               value={info?.gdpGrowth} />
        <StatRow label="Currency"                 value={info?.currency} />
        <StatRow label="Unemployment Rate"        value={info?.unemployment} />
        <StatRow label="Inflation Rate"           value={info?.inflation} />
        <StatRow label="Poverty Rate"             value={info?.povertyRate} />
        <StatRow label="Exports"                  value={info?.exports} />
        <StatRow label="Imports"                  value={info?.imports} />
        <StatRow label="Employment — Services"    value={info?.empServices} />
        <StatRow label="Employment — Industry"    value={info?.empIndustry} />
        <StatRow label="Employment — Agriculture" value={info?.empAgriculture} />
      </InfoCard>

      {/* ── Geography ────────────────────────────────── */}
      <InfoCard title="Geography">
        <StatRow label="Total Area"    value={info?.totalArea} />
        <StatRow label="Borders"       value={info?.borders} />
        <StatRow label="Landlocked"    value={info?.landlocked} />
        <StatRow label="Forested Area" value={info?.forestedArea} />
      </InfoCard>

      {/* ── Social & Health ───────────────────────────── */}
      <InfoCard title="Social & Health">
        <StatRow label="Infant Mortality"       value={info?.infantMortality} />
        <StatRow label="Hospital Beds / 1,000"  value={info?.hospitalBeds} />
        <StatRow label="Physicians / 1,000"     value={info?.physicians} />
        <StatRow label="Education Expenditure"  value={info?.educationExpenditure} />
        <StatRow label="School Life Expectancy" value={info?.schoolLifeExpectancy} />
        <StatRow label="Homicide Rate"          value={info?.homicideRate} />
        <StatRow label="Tourist Arrivals"       value={info?.touristArrivals} />
      </InfoCard>

      {/* ── Environment & Energy ──────────────────────── */}
      <InfoCard title="Environment & Energy">
        <ProgressRow
          label="Electricity Access"
          value={info?.electricityPct}
          displayValue={info?.electricityLabel}
          color="#f07f16"
        />
        <ProgressRow
          label="Renewable Energy"
          value={info?.renewablePct}
          displayValue={info?.renewableLabel}
          color="#76b900"
        />
        <ProgressRow
          label="Forested Area"
          value={info?.forestedAreaPct}
          displayValue={info?.forestedArea}
          color="#3a9b5c"
        />
        <StatRow label="CO₂ Emissions (t/cap)" value={info?.co2Emissions} />
        <StatRow label="Protected Land"         value={info?.protectedLand} />
        <StatRow label="Threatened Species"     value={info?.threatenedSpecies} />
      </InfoCard>

      {/* ── Culture & Misc ───────────────────────────── */}
      <InfoCard title="Culture & Misc">
        <StatRow label="Time Zone(s)" value={info?.timezones} />
        <StatRow label="Calling Code" value={info?.callingCode} />
        <StatRow label="Driving Side" value={info?.drivingSide} />
      </InfoCard>

    </div>
  );
}
