import './CountryBrief.css';

/**
 * CountryBrief — Displays the Nemotron-generated country news digest.
 *
 * Shows:
 *   - 10 bullet "What happened" points
 *   - 3-5 paragraph narrative summary
 *   - 5 "Top topics" clusters
 */
export default function CountryBrief({ brief, status, error }) {
  // Building state
  if (status === 'building') {
    return (
      <section className="brief brief--building">
        <div className="brief__loading">
          <div className="brief__pulse" />
          <span>Generating AI brief with NVIDIA Nemotron...</span>
        </div>
      </section>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <section className="brief brief--error">
        <span className="brief__error-icon">!</span>
        <p className="brief__error-text">{error || 'Brief generation failed.'}</p>
      </section>
    );
  }

  // No brief yet
  if (!brief) return null;

  return (
    <section className="brief">
      <h3 className="brief__heading">
        <span className="brief__nvidia-badge">NVIDIA Nemotron</span>
        Country Brief
      </h3>

      {/* Bullet points */}
      {brief.bullets && brief.bullets.length > 0 && (
        <div className="brief__section">
          <h4 className="brief__subheading">What Happened</h4>
          <ul className="brief__bullets">
            {brief.bullets.map((bullet, i) => (
              <li key={i} className="brief__bullet">{bullet}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Topic clusters */}
      {brief.topics && brief.topics.length > 0 && (
        <div className="brief__section">
          <h4 className="brief__subheading">Top Topics</h4>
          <div className="brief__topics">
            {brief.topics.map((topic, i) => (
              <div key={i} className="brief__topic">
                <span className="brief__topic-name">{topic.name}</span>
                <span className="brief__topic-desc">{topic.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative */}
      {brief.narrative && (
        <div className="brief__section">
          <h4 className="brief__subheading">Summary</h4>
          <div className="brief__narrative">
            {brief.narrative.split('\n').filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
