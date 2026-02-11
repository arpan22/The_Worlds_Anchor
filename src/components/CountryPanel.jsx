import { useState } from "react";
import { formatPublishedDate } from "../services/newsApi";
import CountryBrief from "./CountryBrief";
import ChatPanel from "./ChatPanel";
import "./CountryPanel.css";

// Number of articles to show as "trending"
const TRENDING_COUNT = 3;

function ArticleCard({ article, isTrending = false }) {
  return (
    <article className={`article-card ${isTrending ? "article-card--trending" : ""}`}>
      {isTrending && (
        <div className="article-card__badge">
          <span className="article-card__badge-icon">▲</span>
          TRENDING
        </div>
      )}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="article-card__link"
      >
        <h3 className="article-card__title">{article.title}</h3>
      </a>
      {article.description && (
        <p className="article-card__description">
          {article.description.length > (isTrending ? 150 : 120)
            ? `${article.description.substring(0, isTrending ? 150 : 120)}...`
            : article.description}
        </p>
      )}
      <footer className="article-card__footer">
        <span className="article-card__source">{article.source}</span>
        <span className="article-card__time">
          {formatPublishedDate(article.publishedAt)}
        </span>
      </footer>
    </article>
  );
}

export default function CountryPanel({
  country,
  countrySummary = null,
  onClose,
  articles = [],
  isLoading = false,
  error = null,
  onRefresh,
  // Nemotron session props
  sessionStatus = 'idle',
  brief = null,
  sessionError = null,
  chatMessages = [],
  isChatSending = false,
  onChatSend,
}) {
  const [activeTab, setActiveTab] = useState('news');

  if (!country) return null;

  const trendingArticles = articles.slice(0, TRENDING_COUNT);
  const regularArticles = articles.slice(TRENDING_COUNT);

  const chatDisabled = sessionStatus !== 'ready';
  const chatDisabledReason =
    sessionStatus === 'building'
      ? 'Building brief with NVIDIA Nemotron...'
      : sessionStatus === 'error'
        ? 'Brief generation failed — chat unavailable.'
        : sessionStatus === 'idle'
          ? 'Initializing session...'
          : '';

  return (
    <aside className="panel panel--open">
      <button className="panel__close" onClick={onClose} aria-label="Close panel">
        ×
      </button>

      <header className="panel__header">
        <h2 className="panel__title">{country.properties?.name}</h2>
        <p className="panel__subtitle">Latest News Headlines</p>
      </header>

      {/* Tab bar — separates news feed from AI features */}
      <div className="panel__tabs">
        <button
          className={`panel__tab ${activeTab === 'news' ? 'panel__tab--active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          Headlines
        </button>
        <button
          className={`panel__tab ${activeTab === 'ai' ? 'panel__tab--active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          AI Analysis
          {sessionStatus === 'building' && (
            <span className="panel__tab-dot" />
          )}
        </button>
      </div>

      <div className="panel__body">
        {/* HEADLINES TAB */}
        {activeTab === 'news' && (
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
                <span>Loading news...</span>
              </div>
            )}

            {error && !isLoading && (
              <div className="panel__error">
                <span className="panel__error-icon">!</span>
                <p>{error}</p>
                {onRefresh && (
                  <button className="panel__retry-btn" onClick={onRefresh}>
                    Try Again
                  </button>
                )}
              </div>
            )}

            {!isLoading && !error && articles.length > 0 && (
              <>
                {trendingArticles.length > 0 && (
                  <section className="panel__section">
                    <h3 className="panel__section-title">Trending Now</h3>
                    <div className="panel__articles panel__articles--trending">
                      {trendingArticles.map((article) => (
                        <ArticleCard key={article.id} article={article} isTrending />
                      ))}
                    </div>
                  </section>
                )}

                {regularArticles.length > 0 && (
                  <section className="panel__section">
                    <h3 className="panel__section-title">More Headlines</h3>
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
                <p>No news articles available for this country.</p>
              </div>
            )}
          </>
        )}

        {/* AI ANALYSIS TAB */}
        {activeTab === 'ai' && (
          <>
            <section className="panel__section">
              <CountryBrief
                brief={brief}
                status={sessionStatus}
                error={sessionError}
              />
            </section>

            <section className="panel__section">
              <ChatPanel
                messages={chatMessages}
                isSending={isChatSending}
                onSend={onChatSend}
                disabled={chatDisabled}
                disabledReason={chatDisabledReason}
              />
            </section>
          </>
        )}
      </div>

      {activeTab === 'news' && !isLoading && articles.length > 0 && onRefresh && (
        <footer className="panel__footer">
          <button className="panel__refresh-btn" onClick={onRefresh}>
            Refresh News
          </button>
        </footer>
      )}
    </aside>
  );
}
