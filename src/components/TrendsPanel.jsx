import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchGlobalTrends } from "../services/backendApi";
import "./TrendsPanel.css";

function formatTimestamp(iso) {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function shortenTopic(topic) {
  const text = String(topic || "");
  if (text.length <= 30) return text;
  return `${text.slice(0, 27)}...`;
}

export default function TrendsPanel({ onClose }) {
  const [data, setData] = useState({ source: "none", trends: [], lastUpdated: null, error: null });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const chartData = (data.trends || []).slice(0, 12).map((t) => ({
    topic: shortenTopic(t.topic),
    fullTopic: t.topic,
    score: Number(t.score) || 0,
    mentions: Number(t.mentions) || 1,
    regions: Array.isArray(t.regions) ? t.regions.join(", ") : "",
  }));

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchGlobalTrends();
      setData(result);
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err.message || "Failed to load trends.");
      setData({ source: "none", trends: [], lastUpdated: null, error: null });
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

  return (
    <aside className="trends-panel trends-panel--open">
      <button className="trends-panel__close" onClick={onClose} aria-label="Close trends panel">×</button>

      <header className="trends-panel__header">
        <h2 className="trends-panel__title">Global Trends</h2>
        <p className="trends-panel__subtitle">
          Last updated: {formatTimestamp(data.lastUpdated)}
          {data.source === "fallback" ? " • fallback feed" : ""}
        </p>
      </header>

      <div className="trends-panel__body">
        {isLoading && (
          <div className="trends-panel__loading">
            <div className="trends-panel__spinner" />
            <span>Loading global trends...</span>
          </div>
        )}

        {error && !isLoading && <div className="trends-panel__notice">{error}</div>}

        {!isLoading && chartData.length > 0 && (
          <>
            <section className="trends-panel__chart">
              <h3 className="trends-panel__chart-title">Trending Topics</h3>
              <div className="trends-panel__chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
                    <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }} />
                    <YAxis type="category" dataKey="topic" width={150} tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "rgba(10,15,30,0.95)", border: "1px solid rgba(42,120,139,0.45)", borderRadius: 8 }}
                      formatter={(value, _name, payload) => [`${value}`, `${payload?.payload?.fullTopic || "Trend"}`]}
                      labelFormatter={(_label, payload) => {
                        const item = payload?.[0]?.payload;
                        return item ? `Regions: ${item.regions || "mixed"} · Mentions: ${item.mentions}` : "";
                      }}
                    />
                    <Bar dataKey="score" fill="#f07f16" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="trends-panel__list">
              {data.trends.slice(0, 12).map((trend) => (
                <div key={trend.topic} className="trends-panel__item">
                  <strong>{trend.topic}</strong>
                  <span>Score: {trend.score} · Regions: {(trend.regions || []).join(", ")}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {!isLoading && chartData.length === 0 && (
          <div className="trends-panel__empty">No trends data available right now.</div>
        )}
      </div>

      <footer className="trends-panel__footer">
        <button className="trends-panel__refresh" onClick={load}>Refresh Trends</button>
      </footer>
    </aside>
  );
}
