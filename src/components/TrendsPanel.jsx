import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchGlobalTrends } from "../services/backendApi";
import "./TrendsPanel.css";

function formatTimestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const TABS = [
  { id: "news",       label: "News" },
  { id: "popculture", label: "Pop Culture" },
  { id: "wikipedia",  label: "Wikipedia" },
];

export default function TrendsPanel({ onClose }) {
  const [data, setData]         = useState({ trends: [], popCulture: [], wikipedia: [], lastUpdated: null });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("news");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchGlobalTrends();
      setData(result);
    } catch {
      // keep previous data on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // ── chart data per tab ────────────────────────────────────
  const newsChart = (data.trends || []).slice(0, 10).map((t) => ({
    topic:     t.topic.length > 28 ? `${t.topic.slice(0, 25)}…` : t.topic,
    fullTopic: t.topic,
    score:     Number(t.score) || 0,
    mentions:  Number(t.mentions) || 1,
    regions:   Array.isArray(t.regions) ? t.regions.join(", ") : "",
  }));

  const popChart = (data.popCulture || []).slice(0, 10).map((p) => ({
    topic:     p.topic.length > 28 ? `${p.topic.slice(0, 25)}…` : p.topic,
    fullTopic: p.topic,
    score:     Number(p.score) || 0,
    subreddit: p.subreddit || "",
  }));

  const wikiChart = (data.wikipedia || []).slice(0, 10).map((w) => ({
    topic:     w.topic.length > 28 ? `${w.topic.slice(0, 25)}…` : w.topic,
    fullTopic: w.topic,
    score:     Number(w.views) || 0,
    rank:      w.rank,
  }));

  const chartDataMap = { news: newsChart, popculture: popChart, wikipedia: wikiChart };
  const chartData    = chartDataMap[activeTab] || [];

  return (
    <aside className="trends-panel trends-panel--open">
      <button className="trends-panel__close" onClick={onClose} aria-label="Close trends panel">×</button>

      <header className="trends-panel__header">
        <h2 className="trends-panel__title">Global Trends</h2>
        <p className="trends-panel__subtitle">Last updated: {formatTimestamp(data.lastUpdated)}</p>
      </header>

      {/* Tabs */}
      <nav className="trends-panel__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`trends-panel__tab${activeTab === tab.id ? " trends-panel__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="trends-panel__body">
        {isLoading && (
          <div className="trends-panel__loading">
            <div className="trends-panel__spinner" />
            <span>Loading trends…</span>
          </div>
        )}

        {!isLoading && chartData.length > 0 && (
          <>
            {/* Bar chart */}
            <section className="trends-panel__chart">
              <h3 className="trends-panel__chart-title">
                {activeTab === "news"       && "Trending in the News"}
                {activeTab === "popculture" && "What's Trending Online"}
                {activeTab === "wikipedia"  && "Wikipedia Most Viewed"}
              </h3>
              <div className="trends-panel__chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      type="number"
                      tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
                      tickFormatter={activeTab === "wikipedia" ? (v) => fmt(v) : undefined}
                    />
                    <YAxis type="category" dataKey="topic" width={145} tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "rgba(10,15,30,0.97)", border: "1px solid rgba(42,120,139,0.45)", borderRadius: 8 }}
                      formatter={(value, _n, payload) => {
                        const item = payload?.payload;
                        if (activeTab === "wikipedia") return [fmt(value), "Views"];
                        return [`${value}`, item?.fullTopic || ""];
                      }}
                      labelFormatter={(_label, payload) => {
                        const item = payload?.[0]?.payload;
                        if (!item) return "";
                        if (activeTab === "news")       return `Regions: ${item.regions || "mixed"} · Mentions: ${item.mentions}`;
                        if (activeTab === "popculture") return item.subreddit || "";
                        if (activeTab === "wikipedia")  return `Rank #${item.rank}`;
                        return "";
                      }}
                    />
                    <Bar
                      dataKey="score"
                      fill={activeTab === "popculture" ? "#7c5cbf" : activeTab === "wikipedia" ? "#2a8b6e" : "#f07f16"}
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* List */}
            <section className="trends-panel__list">
              {activeTab === "news" && (data.trends || []).slice(0, 10).map((t, i) => (
                <div key={i} className="trends-panel__item">
                  <strong>{t.topic}</strong>
                  <span>Score {t.score} · {(t.regions || []).join(", ")}</span>
                </div>
              ))}

              {activeTab === "popculture" && (data.popCulture || []).slice(0, 12).map((p, i) => (
                <a
                  key={i}
                  className="trends-panel__item trends-panel__item--link"
                  href={p.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="trends-panel__item-row">
                    <span className="trends-panel__item-rank">#{p.rank}</span>
                    <strong>{p.topic}</strong>
                  </div>
                  <span className="trends-panel__item-sub">{p.subreddit} · {fmt(p.score)} pts</span>
                </a>
              ))}

              {activeTab === "wikipedia" && (data.wikipedia || []).slice(0, 12).map((w, i) => (
                <a
                  key={i}
                  className="trends-panel__item trends-panel__item--link trends-panel__item--wiki"
                  href={w.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="trends-panel__item-row">
                    <span className="trends-panel__item-rank">#{w.rank}</span>
                    <strong>{w.topic}</strong>
                  </div>
                  <span className="trends-panel__item-sub">{fmt(w.views)} views</span>
                </a>
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
