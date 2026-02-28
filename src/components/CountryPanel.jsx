import { useState } from "react";
import CountryBrief from "./CountryBrief";
import GroqChatWidget from "./GroqChatWidget";
import "./CountryPanel.css";

const TRENDING_COUNT = 3;

/** Format a date string for display relative to now */
function formatPublishedDate(isoDate) {
  if (!isoDate) return 'Unknown date';
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Tone badge color */
function toneBadge(tone) {
  if (tone === 'positive') return { label: '▲ Positive', className: 'tone--positive' };
  if (tone === 'negative') return { label: '▼ Negative', className: 'tone--negative' };
  return null;
}

function ArticleCard({ article, isTrending = false }) {
  const badge = toneBadge(article.tone);
  return (
    <article className={`article-card ${isTrending ? "article-card--trending" : ""}`}>
      {isTrending && (
        <div className="article-card__badge">
          <span className="article-card__badge-icon">▲</span>
          TRENDING
        </div>
      )}
      {badge && !isTrending && (
        <span className={`article-card__tone ${badge.className}`}>{badge.label}</span>
      )}
      {article.eventType && article.eventType !== 'General' && (
        <span className="article-card__event-type">{article.eventType}</span>
      )}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="article-card__link"
      >
        <h3 className="article-card__title">{article.title}</h3>
      </a>
      <footer className="article-card__footer">
        <span className="article-card__source">{article.source}</span>
        <span className="article-card__time">
          {formatPublishedDate(article.publishedAt)}
        </span>
      </footer>
    </article>
  );
}

const DATE_RANGE_OPTIONS = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '3d',  label: 'Last 3 days' },
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];
const TONE_OPTIONS = [
  { value: 'all',      label: 'All tones' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral',  label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
];
const EVENT_TYPE_OPTIONS = [
  { value: 'all',         label: 'All types' },
  { value: 'Politics',    label: 'Politics' },
  { value: 'Military',    label: 'Military / Conflict' },
  { value: 'Economy',     label: 'Economy' },
  { value: 'Diplomacy',   label: 'Diplomacy' },
  { value: 'Environment', label: 'Environment' },
  { value: 'Society',     label: 'Society' },
];

export default function CountryPanel({
  country,
  countrySummary = null,
  onClose,
  // Events (GDELT)
  articles = [],
  toneSeries = [],
  isLoading = false,
  error = null,
  onRefresh,
  eventFilters = { dateRange: '7d', tone: 'all', eventType: 'all' },
  onFiltersChange,
  // Nemotron session props
  sessionStatus = 'idle',
  brief = null,
  sessionError = null,
  newsBriefing = '',
  // Graph / timeline
  graphData = null,
  timelineData = null,
  isGeneratingGraph = false,
  isGeneratingTimeline = false,
  onGenerateGraph,
  onGenerateTimeline,
}) {
  const [activeTab, setActiveTab] = useState('events');

  if (!country) return null;

  const trendingArticles = articles.slice(0, TRENDING_COUNT);
  const regularArticles = articles.slice(TRENDING_COUNT);

  function handleFilterChange(key, value) {
    onFiltersChange?.({ ...eventFilters, [key]: value });
  }

  return (
    <aside className="panel panel--open">
      <button className="panel__close" onClick={onClose} aria-label="Close panel">×</button>

      <header className="panel__header">
        <h2 className="panel__title">{country.properties?.name}</h2>
        <p className="panel__subtitle">GDELT Global Events Feed</p>
      </header>

      <div className="panel__tabs">
        <button
          className={`panel__tab ${activeTab === 'events' ? 'panel__tab--active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Events
        </button>
        <button
          className={`panel__tab ${activeTab === 'filters' ? 'panel__tab--active' : ''}`}
          onClick={() => setActiveTab('filters')}
        >
          Filters
        </button>
        <button
          className={`panel__tab ${activeTab === 'ai' ? 'panel__tab--active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          AI Analysis
          {sessionStatus === 'building' && <span className="panel__tab-dot" />}
        </button>
      </div>

      <div className="panel__body">

        {/* ── EVENTS TAB ── */}
        {activeTab === 'events' && (
          <>
            {countrySummary && (
              <section className="panel__section panel__section--summary">
                <h3 className="panel__section-title">About</h3>
                <div className="panel__widget panel__widget--summary">
                  <p className="panel__summary-text">{countrySummary}</p>
                </div>
              </section>
            )}

            {isLoading && (
              <div className="panel__loading">
                <div className="panel__spinner" />
                <span>Fetching GDELT events...</span>
              </div>
            )}

            {error && !isLoading && (
              <div className="panel__error">
                <span className="panel__error-icon">!</span>
                <p>{error}</p>
                {onRefresh && (
                  <button className="panel__retry-btn" onClick={onRefresh}>Try Again</button>
                )}
              </div>
            )}

            {!isLoading && !error && articles.length > 0 && (
              <>
                {trendingArticles.length > 0 && (
                  <section className="panel__section">
                    <h3 className="panel__section-title">Top Stories</h3>
                    <div className="panel__articles panel__articles--trending">
                      {trendingArticles.map((article) => (
                        <ArticleCard key={article.id} article={article} isTrending />
                      ))}
                    </div>
                  </section>
                )}
                {regularArticles.length > 0 && (
                  <section className="panel__section">
                    <h3 className="panel__section-title">More Events</h3>
                    <div className="panel__articles">
                      {regularArticles.map((article) => (
                        <ArticleCard key={article.id} article={article} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {!isLoading && !error && articles.length === 0 && (
              <div className="panel__empty">
                <p>No events found. Try adjusting the date range in Filters.</p>
              </div>
            )}
          </>
        )}

        {/* ── FILTERS TAB ── */}
        {activeTab === 'filters' && (
          <section className="panel__section filters-panel">
            <h3 className="panel__section-title">Event Filters</h3>
            <p className="filters-panel__hint">Filters re-fetch events from GDELT automatically.</p>

            <div className="filters-panel__group">
              <label className="filters-panel__label">Date Range</label>
              <select
                className="filters-panel__select"
                value={eventFilters.dateRange}
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              >
                {DATE_RANGE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="filters-panel__group">
              <label className="filters-panel__label">Tone</label>
              <select
                className="filters-panel__select"
                value={eventFilters.tone}
                onChange={(e) => handleFilterChange('tone', e.target.value)}
              >
                {TONE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="filters-panel__group">
              <label className="filters-panel__label">Event Type</label>
              <select
                className="filters-panel__select"
                value={eventFilters.eventType}
                onChange={(e) => handleFilterChange('eventType', e.target.value)}
              >
                {EVENT_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <button
              className="filters-panel__apply-btn"
              onClick={onRefresh}
            >
              Refresh Events
            </button>
          </section>
        )}

        {/* ── AI ANALYSIS TAB ── */}
        {activeTab === 'ai' && (
          <>
            <section className="panel__section">
              <CountryBrief
                brief={brief}
                status={sessionStatus}
                error={sessionError}
                graphData={graphData}
                timelineData={timelineData}
                isGeneratingGraph={isGeneratingGraph}
                isGeneratingTimeline={isGeneratingTimeline}
                onGenerateGraph={onGenerateGraph}
                onGenerateTimeline={onGenerateTimeline}
              />
            </section>

            <section className="panel__section">
              <GroqChatWidget newsBriefing={newsBriefing} />
            </section>
          </>
        )}
      </div>

      {activeTab === 'events' && !isLoading && articles.length > 0 && onRefresh && (
        <footer className="panel__footer">
          <button className="panel__refresh-btn" onClick={onRefresh}>
            Refresh Events
          </button>
        </footer>
      )}
    </aside>
  );
}
