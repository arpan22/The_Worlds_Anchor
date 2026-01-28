import { formatPublishedDate } from "../services/newsApi";
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
  onClose,
  articles = [],
  isLoading = false,
  error = null,
  onRefresh,
}) {
  if (!country) return null;

  // Split articles into trending and regular
  const trendingArticles = articles.slice(0, TRENDING_COUNT);
  const regularArticles = articles.slice(TRENDING_COUNT);

  return (
    <aside className="panel panel--open">
      <button className="panel__close" onClick={onClose} aria-label="Close panel">
        ×
      </button>

      <header className="panel__header">
        <h2 className="panel__title">{country.properties?.name}</h2>
        <p className="panel__subtitle">Latest News Headlines</p>
      </header>

      <div className="panel__body">
        {/* Loading State */}
        {isLoading && (
          <div className="panel__loading">
            <div className="panel__spinner" />
            <span>Loading news...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="panel__error">
            <span className="panel__error-icon">⚠</span>
            <p>{error}</p>
            {onRefresh && (
              <button className="panel__retry-btn" onClick={onRefresh}>
                Try Again
              </button>
            )}
          </div>
        )}

        {/* Articles List */}
        {!isLoading && !error && articles.length > 0 && (
          <>
            {/* Trending Section */}
            {trendingArticles.length > 0 && (
              <section className="panel__section">
                <h3 className="panel__section-title">
                  <span className="panel__section-icon">🔥</span>
                  Trending Now
                </h3>
                <div className="panel__articles panel__articles--trending">
                  {trendingArticles.map((article) => (
                    <ArticleCard key={article.id} article={article} isTrending />
                  ))}
                </div>
              </section>
            )}

            {/* Regular News Section */}
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

        {/* Empty State */}
        {!isLoading && !error && articles.length === 0 && (
          <div className="panel__empty">
            <p>No news articles available for this country.</p>
          </div>
        )}
      </div>

      {/* Refresh Button */}
      {!isLoading && articles.length > 0 && onRefresh && (
        <footer className="panel__footer">
          <button className="panel__refresh-btn" onClick={onRefresh}>
            ↻ Refresh News
          </button>
        </footer>
      )}
    </aside>
  );
}
