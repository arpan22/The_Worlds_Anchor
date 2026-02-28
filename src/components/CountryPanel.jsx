import { useEffect, useState } from "react";
import CountryBrief from "./CountryBrief";
import GroqChatWidget from "./GroqChatWidget";
import CountryInfo from "./CountryInfo";
import { getCountryCode } from "../utils/countryCodes";
import { getCountrySportsProfile, getCountrySecondarySportsProfile } from "../data/countrySportsProfiles";
import { fetchSportsTable } from "../services/backendApi";
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

function formatNrr(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return `${num >= 0 ? '+' : ''}${num.toFixed(3)}`;
}

function getSportsTableType(leagueMeta) {
  const sport = String(leagueMeta?.sport || '').toLowerCase();
  if (sport.includes('cricket')) return 'cricket';
  if (sport.includes('soccer')) return 'soccer';
  return 'generic';
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

const CATEGORY_TABS = [
  { key: 'Economy', label: 'Economics' },
  { key: 'Crime', label: 'Crime' },
  { key: 'Sports', label: 'Sports' },
];

export default function CountryPanel({
  country,
  onClose,
  // Events (GDELT)
  articles = [],
  toneSeries = [],
  isLoading = false,
  error = null,
  onRefresh,
  eventFilters = { dateRange: '7d', tone: 'all', eventType: 'Economy' },
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
  countryInfo = null,
}) {
  const [activeTab, setActiveTab] = useState('events');
  const [sportsTable, setSportsTable] = useState([]);
  const [sportsMeta, setSportsMeta] = useState({ league: null, season: null, isFallbackSeason: false });
  const [sportsError, setSportsError] = useState(null);
  const [sportsLoading, setSportsLoading] = useState(false);
  const [secondarySportsTable, setSecondarySportsTable] = useState([]);
  const [secondarySportsMeta, setSecondarySportsMeta] = useState({ league: null, season: null, isFallbackSeason: false });
  const [secondarySportsError, setSecondarySportsError] = useState(null);
  const [secondarySportsLoading, setSecondarySportsLoading] = useState(false);
  const [failedBadges, setFailedBadges] = useState({});

  if (!country) return null;

  const trendingArticles = articles.slice(0, TRENDING_COUNT);
  const regularArticles = articles.slice(TRENDING_COUNT);
  const isSportsMode = eventFilters.eventType === 'Sports';
  const primaryTableType = isSportsMode ? getSportsTableType(sportsMeta?.league) : 'generic';
  const secondaryTableType = isSportsMode ? getSportsTableType(secondarySportsMeta?.league) : 'generic';
  const sportsProfile = isSportsMode
    ? getCountrySportsProfile(country.properties?.name || countryInfo?.name || '')
    : null;
  const secondarySportsProfile = isSportsMode
    ? getCountrySecondarySportsProfile(country.properties?.name || countryInfo?.name || '')
    : null;

  const chatDisabled = sessionStatus !== 'ready';
  const chatDisabledReason =
    sessionStatus === 'building' ? 'Building brief with NVIDIA Nemotron...'
    : sessionStatus === 'error'   ? 'Brief generation failed — chat unavailable.'
    : sessionStatus === 'idle'    ? 'Initializing session...'
    : '';

  function handleFilterChange(key, value) {
    onFiltersChange?.({ ...eventFilters, [key]: value });
  }

  function handleCategoryClick(category) {
    handleFilterChange('eventType', category);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSportsTable() {
      if (!isSportsMode) return;
      const countryName = countryInfo?.name || country?.properties?.name;
      const countryCode = countryInfo?.code || getCountryCode(country?.properties?.name);
      if (!countryName || !countryCode) {
        setSportsTable([]);
        setSportsMeta({ league: null, season: null, isFallbackSeason: false });
        setSportsError('Sports table unavailable for this country.');
        setSecondarySportsTable([]);
        setSecondarySportsMeta({ league: null, season: null, isFallbackSeason: false });
        setSecondarySportsError('Secondary sports table unavailable for this country.');
        return;
      }

      setSportsLoading(true);
      setSecondarySportsLoading(true);
      setSportsError(null);
      setSecondarySportsError(null);

      try {
        const [primaryResult, secondaryResult] = await Promise.all([
          fetchSportsTable({ country: countryCode, countryName, slot: 'primary' }),
          fetchSportsTable({ country: countryCode, countryName, slot: 'secondary' }).catch((err) => ({
            table: [],
            league: null,
            season: null,
            isFallbackSeason: false,
            error: err?.message || 'Secondary league table unavailable right now.',
          })),
        ]);
        if (cancelled) return;

        setSportsTable(Array.isArray(primaryResult.table) ? primaryResult.table : []);
        setSportsMeta({
          league: primaryResult.league || null,
          season: primaryResult.season || null,
          isFallbackSeason: Boolean(primaryResult.isFallbackSeason),
        });
        setSportsError(primaryResult.error || null);

        setSecondarySportsTable(Array.isArray(secondaryResult.table) ? secondaryResult.table : []);
        setSecondarySportsMeta({
          league: secondaryResult.league || null,
          season: secondaryResult.season || null,
          isFallbackSeason: Boolean(secondaryResult.isFallbackSeason),
        });
        setSecondarySportsError(secondaryResult.error || null);
      } catch (err) {
        if (cancelled) return;
        setSportsTable([]);
        setSportsMeta({ league: null, season: null, isFallbackSeason: false });
        setSportsError(err.message || 'Failed to load league table.');
        setSecondarySportsTable([]);
        setSecondarySportsMeta({ league: null, season: null, isFallbackSeason: false });
        setSecondarySportsError(null);
      } finally {
        if (!cancelled) {
          setSportsLoading(false);
          setSecondarySportsLoading(false);
        }
      }
    }

    loadSportsTable();
    return () => { cancelled = true; };
  }, [isSportsMode, country, countryInfo]);

  useEffect(() => {
    setFailedBadges({});
  }, [sportsTable]);


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
          className={`panel__tab ${activeTab === 'info' ? 'panel__tab--active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Info
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
            <section className="panel__section panel__section--categories">
              <div className="event-categories">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    className={`event-categories__tab ${eventFilters.eventType === tab.key ? 'event-categories__tab--active' : ''}`}
                    onClick={() => handleCategoryClick(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </section>

            {isSportsMode && sportsProfile && (
              <section className="panel__section">
                <h3 className="panel__section-title">Country Sports Profile</h3>
                <div className="sports-profile">
                  <p className="sports-profile__summary">{sportsProfile.summary}</p>
                  <div className="sports-profile__grid">
                    <div className="sports-profile__item">
                      <span className="sports-profile__label">Top Sport</span>
                      <strong className="sports-profile__value">{sportsProfile.topSport}</strong>
                    </div>
                    <div className="sports-profile__item">
                      <span className="sports-profile__label">Biggest League</span>
                      <strong className="sports-profile__value">{sportsProfile.majorLeague}</strong>
                    </div>
                    <div className="sports-profile__item">
                      <span className="sports-profile__label">Season Window</span>
                      <strong className="sports-profile__value">{sportsProfile.seasonWindow}</strong>
                    </div>
                  </div>
                  {Array.isArray(sportsProfile.notableTeams) && sportsProfile.notableTeams.length > 0 && (
                    <div className="sports-profile__teams">
                      {sportsProfile.notableTeams.map((team) => (
                        <span key={team} className="sports-profile__chip">{team}</span>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {isSportsMode && secondarySportsProfile && (
              <section className="panel__section">
                <h3 className="panel__section-title">Second Most Followed Sport</h3>
                <div className="sports-profile">
                  <p className="sports-profile__summary">{secondarySportsProfile.summary}</p>
                  <div className="sports-profile__grid">
                    <div className="sports-profile__item">
                      <span className="sports-profile__label">Second Sport</span>
                      <strong className="sports-profile__value">{secondarySportsProfile.topSport}</strong>
                    </div>
                    <div className="sports-profile__item">
                      <span className="sports-profile__label">Biggest League</span>
                      <strong className="sports-profile__value">{secondarySportsProfile.majorLeague}</strong>
                    </div>
                    <div className="sports-profile__item">
                      <span className="sports-profile__label">Season Window</span>
                      <strong className="sports-profile__value">{secondarySportsProfile.seasonWindow}</strong>
                    </div>
                  </div>
                  {Array.isArray(secondarySportsProfile.notableTeams) && secondarySportsProfile.notableTeams.length > 0 && (
                    <div className="sports-profile__teams">
                      {secondarySportsProfile.notableTeams.map((team) => (
                        <span key={team} className="sports-profile__chip">{team}</span>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {isSportsMode && sportsLoading && (
              <div className="panel__loading">
                <div className="panel__spinner" />
                <span>Loading league tables...</span>
              </div>
            )}

            {isSportsMode && !sportsLoading && sportsTable.length > 0 && sportsMeta.league?.name && (
              <section className="panel__section">
                <h3 className="panel__section-title">Primary League Table</h3>
                <div className="sports-table-wrap">
                  {sportsError && sportsTable.length > 0 && (
                    <div className="sports-table-note">{sportsError}</div>
                  )}
                  <div className="sports-table-meta">
                    <strong>{sportsMeta.league.name}</strong>
                    <span>
                      {sportsMeta.season
                        ? `Season: ${sportsMeta.season}${sportsMeta.isFallbackSeason ? ' (latest available)' : ''}`
                        : 'Latest available standings'}
                    </span>
                  </div>
                  <div className="sports-table-scroll">
                    <table className="sports-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Team</th>
                          {primaryTableType === 'soccer' && <th>P</th>}
                          <th>W</th>
                          {primaryTableType === 'soccer' && <th>D</th>}
                          <th>L</th>
                          {primaryTableType === 'cricket' && <th>NR</th>}
                          {primaryTableType === 'cricket' && <th>NRR</th>}
                          <th>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sportsTable.slice(0, 20).map((row) => (
                          <tr key={`${row.position}-${row.team}`}>
                            <td>{row.position}</td>
                            <td>
                              <div className="sports-table__team">
                                {row.badge && !failedBadges[`primary-${row.position}-${row.team}`] ? (
                                  <img
                                    src={row.badge}
                                    alt={`${row.team} emblem`}
                                    className="sports-table__badge"
                                    loading="lazy"
                                    onError={() => {
                                      const key = `primary-${row.position}-${row.team}`;
                                      setFailedBadges((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
                                    }}
                                  />
                                ) : (
                                  <span className="sports-table__badge-placeholder">
                                    {String(row.team || '?').slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                                <span>{row.team}</span>
                              </div>
                            </td>
                            {primaryTableType === 'soccer' && <td>{row.played}</td>}
                            <td>{row.win}</td>
                            {primaryTableType === 'soccer' && <td>{row.draw}</td>}
                            <td>{row.loss}</td>
                            {primaryTableType === 'cricket' && <td>{row.noResult ?? 0}</td>}
                            {primaryTableType === 'cricket' && <td>{formatNrr(row.nrr)}</td>}
                            <td>{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {isSportsMode && !secondarySportsLoading && secondarySportsTable.length > 0 && secondarySportsMeta.league?.name && (
              <section className="panel__section">
                <h3 className="panel__section-title">Secondary League Table</h3>
                <div className="sports-table-wrap">
                  {secondarySportsError && secondarySportsTable.length > 0 && (
                    <div className="sports-table-note">{secondarySportsError}</div>
                  )}
                  <div className="sports-table-meta">
                    <strong>{secondarySportsMeta.league.name}</strong>
                    <span>
                      {secondarySportsMeta.season
                        ? `Season: ${secondarySportsMeta.season}${secondarySportsMeta.isFallbackSeason ? ' (latest available)' : ''}`
                        : 'Latest available standings'}
                    </span>
                  </div>
                  <div className="sports-table-scroll">
                    <table className="sports-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Team</th>
                          {secondaryTableType === 'soccer' && <th>P</th>}
                          <th>W</th>
                          {secondaryTableType === 'soccer' && <th>D</th>}
                          <th>L</th>
                          {secondaryTableType === 'cricket' && <th>NR</th>}
                          {secondaryTableType === 'cricket' && <th>NRR</th>}
                          <th>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {secondarySportsTable.slice(0, 20).map((row) => (
                          <tr key={`secondary-${row.position}-${row.team}`}>
                            <td>{row.position}</td>
                            <td>
                              <div className="sports-table__team">
                                {row.badge && !failedBadges[`secondary-${row.position}-${row.team}`] ? (
                                  <img
                                    src={row.badge}
                                    alt={`${row.team} emblem`}
                                    className="sports-table__badge"
                                    loading="lazy"
                                    onError={() => {
                                      const key = `secondary-${row.position}-${row.team}`;
                                      setFailedBadges((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
                                    }}
                                  />
                                ) : (
                                  <span className="sports-table__badge-placeholder">
                                    {String(row.team || '?').slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                                <span>{row.team}</span>
                              </div>
                            </td>
                            {secondaryTableType === 'soccer' && <td>{row.played}</td>}
                            <td>{row.win}</td>
                            {secondaryTableType === 'soccer' && <td>{row.draw}</td>}
                            <td>{row.loss}</td>
                            {secondaryTableType === 'cricket' && <td>{row.noResult ?? 0}</td>}
                            {secondaryTableType === 'cricket' && <td>{formatNrr(row.nrr)}</td>}
                            <td>{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {isSportsMode && !sportsProfile && (
              <div className="panel__empty">
                <p>Sports profile is not available for this country yet.</p>
              </div>
            )}

            {!isSportsMode && isLoading && (
              <div className="panel__loading">
                <div className="panel__spinner" />
                <span>Fetching GDELT events...</span>
              </div>
            )}

            {!isSportsMode && error && !isLoading && (
              <div className="panel__error">
                <span className="panel__error-icon">!</span>
                <p>{error}</p>
                {onRefresh && (
                  <button className="panel__retry-btn" onClick={onRefresh}>Try Again</button>
                )}
              </div>
            )}

            {!isSportsMode && !isLoading && !error && articles.length > 0 && (
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

            {!isSportsMode && !isLoading && !error && articles.length === 0 && (
              <div className="panel__empty">
                <p>No events found for this category.</p>
              </div>
            )}
          </>
        )}

        {/* ── INFO TAB ── */}
        {activeTab === 'info' && (
          <>
            <CountryInfo
              countryName={country.properties?.name}
              countryCode={getCountryCode(country.properties?.name)}
            />
          </>
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

      {activeTab === 'events' && !isSportsMode && !isLoading && articles.length > 0 && onRefresh && (
        <footer className="panel__footer">
          <button className="panel__refresh-btn" onClick={onRefresh}>
            Refresh Events
          </button>
        </footer>
      )}
    </aside>
  );
}
