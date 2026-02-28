import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from 'recharts';
import './CountryBrief.css';

const TONE_COLORS = {
  positive: '#76b900',
  negative: '#e05252',
  neutral:  '#2a788b',
};

export default function CountryBrief({
  brief,
  status,
  error,
  graphData = null,
  timelineData = null,
  isGeneratingGraph = false,
  isGeneratingTimeline = false,
  onGenerateGraph,
  onGenerateTimeline,
}) {
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

  if (status === 'error') {
    return (
      <section className="brief brief--error">
        <span className="brief__error-icon">!</span>
        <p className="brief__error-text">{error || 'Brief generation failed.'}</p>
      </section>
    );
  }

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

      {/* AI Actions */}
      <div className="brief__section brief__actions">
        <button
          className="brief__action-btn"
          onClick={onGenerateGraph}
          disabled={isGeneratingGraph}
        >
          {isGeneratingGraph ? 'Generating...' : '📊 Generate Graph'}
        </button>
        <button
          className="brief__action-btn"
          onClick={onGenerateTimeline}
          disabled={isGeneratingTimeline}
        >
          {isGeneratingTimeline ? 'Generating...' : '📅 Generate Timeline'}
        </button>
      </div>

      {/* Graph Section */}
      {graphData && graphData.data && graphData.data.length > 0 && (
        <div className="brief__section brief__chart-section">
          <h4 className="brief__subheading">{graphData.title || 'Topic Distribution'}</h4>
          <div className="brief__chart-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={graphData.data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#0a0f1e', border: '1px solid #2a788b', borderRadius: 6, color: '#fff', fontSize: 12 }}
                  cursor={{ fill: 'rgba(42,120,139,0.1)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {graphData.data.map((entry, i) => (
                    <Cell key={i} fill={entry.fill || '#2a788b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Timeline Section */}
      {timelineData && timelineData.events && timelineData.events.length > 0 && (
        <div className="brief__section">
          <h4 className="brief__subheading">{timelineData.title || 'Event Timeline'}</h4>
          <div className="brief__timeline">
            {timelineData.events.map((ev, i) => (
              <div key={i} className={`brief__timeline-event brief__timeline-event--${ev.tone || 'neutral'}`}>
                <div className="brief__timeline-dot" style={{ background: TONE_COLORS[ev.tone] || '#2a788b' }} />
                <div className="brief__timeline-content">
                  <span className="brief__timeline-date">{ev.date}</span>
                  <strong className="brief__timeline-title">{ev.title}</strong>
                  <p className="brief__timeline-desc">{ev.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
