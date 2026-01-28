import { formatPublishedDate } from "../services/newsApi";
import "./CountryPanel.css";

export default function CountryPanel({
  country,
  onClose,
  articles = [],
  isLoading = false,
  error = null,
  onRefresh,
}) {
  if (!country) return null;

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
          <div className="panel__articles">
            {articles.map((article) => (
              <article key={article.id} className="article-card">
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
                    {article.description.length > 120
                      ? `${article.description.substring(0, 120)}...`
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
            ))}
          </div>
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
