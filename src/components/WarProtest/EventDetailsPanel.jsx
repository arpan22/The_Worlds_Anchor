/**
 * EventDetailsPanel — Displays details for a selected ACLED event.
 *
 * Shows: event type + date, location chips, actor info, fatalities,
 * expandable notes, source, and a "Related News" button that calls
 * the existing GDELT news pipeline.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { getCountryCode } from '../../utils/countryCodes.js';
import { fetchEvents } from '../../services/backendApi.js';
import './EventDetailsPanel.css';

const EVENT_COLORS = {
  Battles: '#e74c3c',
  'Explosions/Remote violence': '#e67e22',
  'Violence against civilians': '#c0392b',
  Protests: '#3498db',
  Riots: '#9b59b6',
  'Strategic developments': '#1abc9c',
};

function typeColor(t) {
  return EVENT_COLORS[t] || '#95a5a6';
}

function Chip({ label, value }) {
  if (!value) return null;
  return (
    <span className="warpro-details__chip">
      <span className="warpro-details__chip-label">{label}</span>
      {value}
    </span>
  );
}

function metricText(value, digits = 0) {
  if (value == null) return '—';
  return digits > 0 ? Number(value).toFixed(digits) : Number(value).toLocaleString();
}

function indexChartData(conflictIndex) {
  if (!conflictIndex) return [];
  return [
    { key: 'Deadliness', ranking: conflictIndex.deadlinessRanking ?? 0 },
    { key: 'Danger', ranking: conflictIndex.dangerRanking ?? 0 },
    { key: 'Diffusion', ranking: conflictIndex.diffusionRanking ?? 0 },
    { key: 'Fragmentation', ranking: conflictIndex.fragmentationRanking ?? 0 },
  ];
}

export default function EventDetailsPanel({ event, onClose }) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [relatedNews, setRelatedNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(null);
  const [showNews, setShowNews] = useState(false);
  const conflictIndexTrend = useMemo(() => indexChartData(event?.conflictIndex), [event?.conflictIndex]);

  // Reset state when a new event is selected
  useEffect(() => {
    setNotesExpanded(false);
    setShowNews(false);
    setRelatedNews([]);
    setNewsError(null);
  }, [event?.event_id]);

  if (!event) {
    return (
      <div className="warpro-details warpro-details--empty">
        <div className="warpro-details__placeholder">
          <span>🗺️</span>
          <p>Click an event on the map to see details.</p>
        </div>
      </div>
    );
  }

  const notes = event.notes || '';
  const shortNotes = notes.slice(0, 220);
  const hasMoreNotes = notes.length > 220;
  const color = typeColor(event.event_type);

  const handleRelatedNews = async () => {
    setShowNews(true);
    if (relatedNews.length > 0) return; // already loaded
    setNewsLoading(true);
    setNewsError(null);

    try {
      const countryCode = getCountryCode(event.country);
      if (!countryCode) throw new Error(`No ISO code for "${event.country}"`);
      const data = await fetchEvents({
        country: countryCode,
        countryName: event.country,
        dateRange: '7d',
        tone: 'all',
        eventType: 'all',
      });
      setRelatedNews((data.articles || []).slice(0, 8));
    } catch (err) {
      setNewsError(err.message);
    } finally {
      setNewsLoading(false);
    }
  };

  return (
    <div className="warpro-details">
      <div className="warpro-details__header">
        <div className="warpro-details__type" style={{ borderLeftColor: color }}>
          <span className="warpro-details__event-type" style={{ color }}>
            {event.event_type}
          </span>
          {event.sub_event_type && (
            <span className="warpro-details__sub-type">· {event.sub_event_type}</span>
          )}
        </div>
        <span className="warpro-details__date">{event.event_date}</span>
        <button className="warpro-details__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {/* Location chips */}
      <div className="warpro-details__chips">
        <Chip label="Country" value={event.country} />
        <Chip label="Region" value={event.admin1} />
        <Chip label="District" value={event.admin2} />
        <Chip label="Location" value={event.location} />
      </div>

      {/* Actors */}
      <div className="warpro-details__section">
        <h4 className="warpro-details__section-title">Actors</h4>
        <div className="warpro-details__actors">
          <div className="warpro-details__actor">
            <span className="warpro-details__actor-label">Side A</span>
            <span className="warpro-details__actor-name">
              {event.actor1 || '—'}
            </span>
          </div>
          {event.actor2 && (
            <>
              <span className="warpro-details__vs">vs</span>
              <div className="warpro-details__actor">
                <span className="warpro-details__actor-label">Side B</span>
                <span className="warpro-details__actor-name">{event.actor2}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Impact */}
      <div className="warpro-details__section">
        <h4 className="warpro-details__section-title">Impact</h4>
        <div className="warpro-details__fatalities">
          <span
            className="warpro-details__fat-badge"
            style={{ background: event.fatalities > 0 ? 'rgba(231,76,60,0.15)' : 'rgba(255,255,255,0.07)', color: event.fatalities > 0 ? '#e74c3c' : 'rgba(255,255,255,0.4)' }}
          >
            {event.fatalities > 0
              ? `${event.fatalities} reported fatalities`
              : 'No fatalities reported'}
          </span>
        </div>
      </div>

      {/* Aggregate event count (local xlsx mode) */}
      {event._event_count != null && (
        <div className="warpro-details__section">
          <h4 className="warpro-details__section-title">Political Violence Events</h4>
          <span className="warpro-details__fat-badge" style={{ background: 'rgba(230,126,34,0.12)', color: '#e67e22' }}>
            {event._event_count.toLocaleString()} events recorded this month
          </span>
        </div>
      )}

      {event.conflictIndex && (
        <div className="warpro-details__section">
          <h4 className="warpro-details__section-title">ACLED Conflict Index 2025</h4>
          <div className="warpro-details__index-head">
            <span className="warpro-details__index-level">{event.conflictIndex.level || 'Unrated'}</span>
            <span className="warpro-details__index-rank">
              Global rank #{metricText(event.conflictIndex.ranking)}
            </span>
          </div>
          <div className="warpro-details__index-chart">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={conflictIndexTrend} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="key"
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  reversed
                  domain={[1, 25]}
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value) => [`#${metricText(value)}`, 'Rank']}
                  contentStyle={{
                    background: 'rgba(10, 15, 30, 0.96)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="ranking"
                  stroke="#f6c453"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#f6c453', stroke: '#0a0f1e', strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="warpro-details__index-strip">
            <div className="warpro-details__index-mini">
              <span>Deadliness</span>
              <strong>{metricText(event.conflictIndex.deadlinessValue)}</strong>
            </div>
            <div className="warpro-details__index-mini">
              <span>Danger</span>
              <strong>{metricText(event.conflictIndex.dangerValue)}</strong>
            </div>
            <div className="warpro-details__index-mini">
              <span>Diffusion</span>
              <strong>{metricText(event.conflictIndex.diffusionValue, 3)}</strong>
            </div>
            <div className="warpro-details__index-mini">
              <span>Fragmentation</span>
              <strong>{metricText(event.conflictIndex.fragmentationValue)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div className="warpro-details__section">
          <h4 className="warpro-details__section-title">Notes</h4>
          <p className="warpro-details__notes">
            {notesExpanded ? notes : shortNotes}
            {hasMoreNotes && !notesExpanded && '…'}
          </p>
          {hasMoreNotes && (
            <button
              className="warpro-details__expand-btn"
              onClick={() => setNotesExpanded((v) => !v)}
            >
              {notesExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {/* Source */}
      {event.source && (
        <div className="warpro-details__section">
          <h4 className="warpro-details__section-title">Source</h4>
          <p className="warpro-details__source">{event.source}</p>
        </div>
      )}

      {/* Related News */}
      <div className="warpro-details__section">
        {!showNews ? (
          <button className="warpro-details__news-btn" onClick={handleRelatedNews}>
            Find Related News
          </button>
        ) : (
          <div className="warpro-details__related">
            <h4 className="warpro-details__section-title">Related News (GDELT)</h4>
            {newsLoading && (
              <p className="warpro-details__loading">Fetching articles…</p>
            )}
            {newsError && (
              <p className="warpro-details__err">{newsError}</p>
            )}
            {!newsLoading && relatedNews.length === 0 && !newsError && (
              <p className="warpro-details__empty">No recent articles found.</p>
            )}
            <ul className="warpro-details__articles">
              {relatedNews.map((a, i) => (
                <li key={i} className="warpro-details__article">
                  <a
                    href={a.url || a.seendate}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="warpro-details__article-title"
                  >
                    {a.title || 'Untitled'}
                  </a>
                  <div className="warpro-details__article-meta">
                    {a.domain && <span>{a.domain}</span>}
                    {a.seendate && <span>{a.seendate.slice(0, 10)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className="warpro-details__attribution">
        Data:{' '}
        <a
          href="https://acleddata.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          ACLED
        </a>
      </div>
    </div>
  );
}
