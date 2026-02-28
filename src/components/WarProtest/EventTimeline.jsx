/**
 * EventTimeline — Recharts charts for ACLED event aggregates
 *
 * Shows:
 *  1. Events per week (BarChart, toggleable to daily)
 *  2. Fatalities per week (AreaChart)
 *  3. Event type breakdown (horizontal BarChart)
 *
 * Clicking a bar highlights events for that date range on the map.
 */
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import './EventTimeline.css';

const EVENT_COLORS = {
  Battles: '#e74c3c',
  'Explosions/Remote violence': '#e67e22',
  'Violence against civilians': '#c0392b',
  Protests: '#3498db',
  Riots: '#9b59b6',
  'Strategic developments': '#1abc9c',
};
const DEFAULT_COLOR = '#95a5a6';

function shortDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y.slice(2)}`;
}

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="warpro-chart__tooltip">
      <p className="warpro-chart__tooltip-label">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value.toLocaleString()}</strong>
          {unit ? ` ${unit}` : ''}
        </p>
      ))}
    </div>
  );
};

const RANGE_LABELS = {
  '24h': 'Last 24 Hours',
  '7d': 'Last Week',
  '30d': 'Last Month',
  '1y': 'Last Year',
  '5y': 'Last 5 Years',
};

export default function EventTimeline({ aggregates, rangePreset = '30d', onDateRangeSelect }) {
  const { timeline = [], typeBreakdown = [] } = aggregates || {};

  const chartData = useMemo(
    () => timeline.filter((d) => d.date !== 'unknown'),
    [timeline]
  );

  const topTypes = typeBreakdown.slice(0, 6);
  const totalEvents = chartData.reduce((s, d) => s + d.count, 0);
  const totalFatalities = chartData.reduce((s, d) => s + d.fatalities, 0);

  if (chartData.length === 0 && topTypes.length === 0) {
    return (
      <div className="warpro-charts warpro-charts--empty">
        <span>No timeline data yet. Select a country and date range above.</span>
      </div>
    );
  }

  return (
    <div className="warpro-charts">
      {/* Header */}
      <div className="warpro-charts__header">
        <div className="warpro-charts__summary">
          <span className="warpro-charts__stat">
            <strong>{totalEvents.toLocaleString()}</strong> events
          </span>
          <span className="warpro-charts__stat warpro-charts__stat--fatal">
            <strong>{totalFatalities.toLocaleString()}</strong> reported fatalities (ACLED)
          </span>
          <span className="warpro-charts__stat warpro-charts__stat--range">
            {RANGE_LABELS[rangePreset] || 'Selected Range'}
          </span>
        </div>
      </div>

      <div className="warpro-charts__row">
        {/* Events chart */}
        {chartData.length > 0 && (
          <div className="warpro-charts__panel">
            <p className="warpro-charts__title">Events</p>
            <div className="warpro-charts__viz">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="count"
                    name="Events"
                    fill="#3498db"
                    radius={[2, 2, 0, 0]}
                    cursor="pointer"
                    onClick={(d) => onDateRangeSelect?.(d.date)}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Fatalities chart */}
        {chartData.length > 0 && (
          <div className="warpro-charts__panel">
            <p className="warpro-charts__title">Reported Fatalities (ACLED)</p>
            <div className="warpro-charts__viz">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e74c3c" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#e74c3c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    dataKey="fatalities"
                    name="Fatalities"
                    stroke="#e74c3c"
                    fill="url(#fatGrad)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Type breakdown */}
        {topTypes.length > 0 && (
          <div className="warpro-charts__panel warpro-charts__panel--types">
            <p className="warpro-charts__title">By Event Type</p>
            <div className="warpro-charts__viz">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topTypes}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="type"
                    type="category"
                    width={120}
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v.length > 18 ? v.slice(0, 17) + '…' : v}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Events" radius={[0, 2, 2, 0]}>
                    {topTypes.map((entry) => (
                      <Cell
                        key={entry.type}
                        fill={EVENT_COLORS[entry.type] || DEFAULT_COLOR}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
