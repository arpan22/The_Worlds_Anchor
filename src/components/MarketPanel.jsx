import { useCallback, useEffect, useState } from "react";
import { fetchGlobalMarkets, fetchGlobalMarketsHistory } from "../services/backendApi";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import "./MarketPanel.css";

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSigned(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n).toFixed(digits);
  return `${n >= 0 ? "+" : "-"}${abs}`;
}

function formatTimestamp(iso) {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatHourLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function formatPercent(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n).toFixed(digits);
  return `${n >= 0 ? "+" : "-"}${abs}%`;
}

export default function MarketPanel({ onClose }) {
  const [data, setData] = useState({ source: "none", quotes: [], lastUpdated: null, error: null });
  const [historyData, setHistoryData] = useState({ source: "none", seriesBySymbol: {}, symbols: [], error: null });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const lineColors = ["#f07f16", "#2a788b", "#76b900", "#ff6b6b", "#66d9e8", "#ffd166", "#c77dff", "#5dd39e", "#ff9f1c", "#4895ef"];
  const colorBySymbol = new Map(
    (data.quotes || []).map((q, idx) => [q.symbol, lineColors[idx % lineColors.length]])
  );

  const chartData = data.quotes
    .filter((q) => Number.isFinite(Number(q.changePercent)))
    .map((q) => ({
      symbol: q.symbol,
      name: q.name,
      changePercent: Number(q.changePercent),
      color: colorBySymbol.get(q.symbol) || "#2a788b",
    }));

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [snapshot, history] = await Promise.all([
        fetchGlobalMarkets(),
        fetchGlobalMarketsHistory(),
      ]);
      setData(snapshot);
      setHistoryData(history);

      const messages = [snapshot.error, history.error].filter(Boolean);
      if (messages.length > 0) {
        setError(messages.join(" "));
      }
    } catch (err) {
      setError(err.message || "Failed to load market data.");
      setData({ source: "none", quotes: [], lastUpdated: null, error: null });
      setHistoryData({ source: "none", seriesBySymbol: {}, symbols: [], error: null });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      load();
    }, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const lineData = buildNormalizedLineData(historyData.seriesBySymbol, data.quotes);
  const yAxisDomain = computeLineDomain(lineData, data.quotes);

  return (
    <aside className="market-panel market-panel--open">
      <button className="market-panel__close" onClick={onClose} aria-label="Close market panel">×</button>

      <header className="market-panel__header">
        <h2 className="market-panel__title">Global Stock Markets</h2>
        <p className="market-panel__subtitle">
          Last updated: {formatTimestamp(data.lastUpdated)}
          {data.source === "fallback" ? " • fallback watchlist" : ""}
        </p>
      </header>

      <div className="market-panel__body">
        {isLoading && (
          <div className="market-panel__loading">
            <div className="market-panel__spinner" />
            <span>Loading market snapshot...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="market-panel__notice">{error}</div>
        )}

        {!isLoading && data.quotes.length > 0 && (
          <>
            <div className="market-panel__table-wrap">
              <table className="market-panel__table">
                <thead>
                  <tr>
                    <th>Index</th>
                    <th>Region</th>
                    <th>Price</th>
                    <th>Change</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.quotes.map((q) => {
                    const up = Number(q.change) >= 0;
                    return (
                      <tr key={q.symbol}>
                        <td>
                          <div className="market-panel__index-name">{q.name}</div>
                          <div className="market-panel__index-symbol">{q.symbol}</div>
                        </td>
                        <td>{q.region}</td>
                        <td>{formatPrice(q.price)}</td>
                        <td className={up ? "market-panel__up" : "market-panel__down"}>{formatSigned(q.change)}</td>
                        <td className={up ? "market-panel__up" : "market-panel__down"}>{formatSigned(q.changePercent)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {chartData.length > 0 && (
              <section className="market-panel__chart">
                <h3 className="market-panel__chart-title">Live % Change Snapshot</h3>
                <div className="market-panel__chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                      <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "rgba(10,15,30,0.95)", border: "1px solid rgba(42,120,139,0.45)", borderRadius: 8 }}
                        formatter={(value) => [`${formatSigned(value)}%`, "Change"]}
                      />
                      <Bar dataKey="changePercent">
                        {chartData.map((entry) => (
                          <Cell key={`bar-cell-${entry.symbol}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            <section className="market-panel__chart">
              <h3 className="market-panel__chart-title">Live Price Trend (All Indices)</h3>
              <div className="market-panel__line-subtitle">Last 24 hours, % change from start (zoomed for visible movement).</div>
              <div className="market-panel__chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                    <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis
                      tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                      domain={yAxisDomain}
                      tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "rgba(10,15,30,0.95)", border: "1px solid rgba(42,120,139,0.45)", borderRadius: 8 }}
                      formatter={(value) => [formatPercent(value), "24h change"]}
                    />
                    {data.quotes.map((q, idx) => (
                      <Line
                        key={q.symbol}
                        type="monotone"
                        dataKey={q.symbol}
                        name={q.name}
                        stroke={colorBySymbol.get(q.symbol) || lineColors[idx % lineColors.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}

        {!isLoading && data.quotes.length === 0 && (
          <div className="market-panel__empty">No market data available right now.</div>
        )}
      </div>

      <footer className="market-panel__footer">
        <button className="market-panel__refresh" onClick={load}>Refresh Markets</button>
      </footer>
    </aside>
  );
}

function buildCombinedLineData(historyBySymbol, quotes) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const startTs = now - DAY_MS;
  const symbols = (quotes || []).map((q) => q.symbol);
  const tsSet = new Set();

  for (const symbol of symbols) {
    for (const point of historyBySymbol?.[symbol] || []) {
      const ts = Date.parse(point?.time || "");
      if (!Number.isFinite(ts) || ts < startTs) continue;
      tsSet.add(ts);
    }
  }

  const timestamps = [...tsSet].sort((a, b) => a - b);
  const bySymbol = {};
  for (const symbol of symbols) {
    bySymbol[symbol] = (historyBySymbol?.[symbol] || [])
      .map((p) => ({ ts: Date.parse(p?.time || ""), price: Number(p?.price) }))
      .filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.price) && p.ts >= startTs)
      .sort((a, b) => a.ts - b.ts);
  }

  const baseline = {};
  for (const symbol of symbols) {
    const first = bySymbol[symbol][0];
    baseline[symbol] = first?.price || null;
  }

  const rows = timestamps.map((ts) => {
    const row = { time: formatHourLabel(new Date(ts).toISOString()) };
    for (const symbol of symbols) {
      const point = bySymbol[symbol].find((p) => p.ts === ts);
      if (!point || !baseline[symbol]) {
        row[symbol] = null;
      } else {
        row[symbol] = ((point.price / baseline[symbol]) - 1) * 100;
      }
    }
    return row;
  });

  return rows;
}

function buildNormalizedLineData(historyBySymbol, quotes) {
  return buildCombinedLineData(historyBySymbol, quotes);
}

function computeLineDomain(lineData, quotes) {
  const symbols = (quotes || []).map((q) => q.symbol);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const row of lineData || []) {
    for (const symbol of symbols) {
      const value = Number(row?.[symbol]);
      if (!Number.isFinite(value)) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [-2, 2];
  }
  if (min === max) {
    const pad = Math.max(0.5, Math.abs(min) * 0.2);
    return [min - pad, max + pad];
  }

  const span = max - min;
  const pad = Math.max(0.2, span * 0.15);
  return [min - pad, max + pad];
}
