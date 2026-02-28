/**
 * WarProtestView — Main container for the War/Protest section.
 *
 * Layout (desktop):
 *   TopBar (global) → FilterBar → [Map | DetailsPanel] → Charts → Footer
 *
 * Uses:
 *   - Leaflet (AcledMap) for event mapping
 *   - Recharts (EventTimeline) for time series
 *   - ACLED data via useAcledEvents hook
 *
 * Attribution: "Data: ACLED" is shown in the map legend, details panel,
 * and the view footer. No bulk export features are provided.
 */
import { useState, useCallback, useMemo } from 'react';
import { useAcledEvents } from '../../hooks/useAcledEvents.js';
import FilterBar from './FilterBar.jsx';
import AcledMap from './AcledMap.jsx';
import EventTimeline from './EventTimeline.jsx';
import EventDetailsPanel from './EventDetailsPanel.jsx';
import './WarProtestView.css';

/** Returns today's date as YYYY-MM-DD */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Returns date N days ago as YYYY-MM-DD */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function yearsAgo(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
}

function resolveRangePreset(preset) {
  switch (preset) {
    case '24h':
      return { start_date: daysAgo(1), end_date: today() };
    case '7d':
      return { start_date: daysAgo(7), end_date: today() };
    case '30d':
      return { start_date: daysAgo(30), end_date: today() };
    case '1y':
      return { start_date: yearsAgo(1), end_date: today() };
    case '5y':
      return { start_date: yearsAgo(5), end_date: today() };
    default:
      return { start_date: daysAgo(30), end_date: today() };
  }
}

const DEFAULT_FILTERS = {
  country: '',
  ...resolveRangePreset('30d'),
  range_preset: '30d',
  actor: '',
  admin1: '',
};

export default function WarProtestView() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const { events, aggregates, total, isLoading, error, attribution, source } =
    useAcledEvents(filters);

  const handleSelectEvent = useCallback((event) => {
    setSelectedEvent(event);
    if (event?.country && filters.country !== event.country) {
      setFilters((prev) => ({ ...prev, country: event.country }));
    }
  }, [filters.country]);

  const handleClearEvent = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleFiltersChange = useCallback((newFilters) => {
    const nextFilters = { ...newFilters };
    if (nextFilters.range_preset && nextFilters.range_preset !== filters.range_preset) {
      Object.assign(nextFilters, resolveRangePreset(nextFilters.range_preset));
    }
    setFilters(nextFilters);
    setSelectedEvent(null);
  }, [filters.range_preset]);

  // Filter events to visible (those with coordinates)
  const mappableEvents = useMemo(
    () => events.filter((e) => e.latitude != null && e.longitude != null),
    [events]
  );
  const emptyMapMessage = error || 'No political violence data is available for the current filters.';

  return (
    <div className="warpro">
      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        total={total}
        isLoading={isLoading}
      />

      {/* Error state */}
      {error && !isLoading && (
        <div className="warpro__error">
          <span className="warpro__error-icon">⚠️</span>
          <div>
            <strong>Could not load conflict data</strong>
            <p>{error}</p>
            {error.includes('ACLED_API_KEY') && (
              <p className="warpro__error-help">
                Set <code>ACLED_API_KEY</code> and <code>ACLED_EMAIL</code> in your{' '}
                <code>.env</code> file and restart the server. Register free at{' '}
                <a href="https://developer.acleddata.com" target="_blank" rel="noopener noreferrer">
                  developer.acleddata.com
                </a>.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main content: map + details */}
      <div className="warpro__main">
        {/* Map toolbar */}
        <div className="warpro__map-area">
          <div className="warpro__map-toolbar">
            <button
              className={`warpro__mode-btn${!showHeatmap ? ' warpro__mode-btn--active' : ''}`}
              onClick={() => setShowHeatmap(false)}
            >
              Markers
            </button>
            <button
              className={`warpro__mode-btn${showHeatmap ? ' warpro__mode-btn--active' : ''}`}
              onClick={() => setShowHeatmap(true)}
            >
              Heatmap
            </button>
            {isLoading && (
              <span className="warpro__map-loading">Loading events…</span>
            )}
            {!isLoading && mappableEvents.length > 0 && (
              <span className="warpro__map-count">
                {mappableEvents.length.toLocaleString()} plotted
              </span>
            )}
            {selectedEvent?.country && (
              <span className="warpro__selected-country">
                Selected: {selectedEvent.country}
              </span>
            )}
            {source && (
              <span className="warpro__source-badge">
                {source === 'local-xlsx' ? 'Bundled ACLED data (xlsx)' : 'Live ACLED API'}
              </span>
            )}
          </div>

          <AcledMap
            events={mappableEvents}
            onSelectEvent={handleSelectEvent}
            selectedEventId={selectedEvent?.event_id}
            showHeatmap={showHeatmap}
            emptyMessage={!isLoading ? emptyMapMessage : ''}
            focusCountry={filters.country}
          />
        </div>

        {/* Event details panel */}
        <EventDetailsPanel event={selectedEvent} onClose={handleClearEvent} />
      </div>
      {/* Timeline charts */}
      <EventTimeline aggregates={aggregates} rangePreset={filters.range_preset} />

      {/* Footer attribution */}
      <div className="warpro__footer">
        <a
          href="https://acleddata.com"
          target="_blank"
          rel="noopener noreferrer"
          className="warpro__footer-link"
        >
          {attribution || 'Data: ACLED (Armed Conflict Location & Event Data Project)'}
        </a>
        <span className="warpro__footer-sep">·</span>
        <span>For informational purposes only</span>
        <span className="warpro__footer-sep">·</span>
        <span>No bulk export</span>
      </div>
    </div>
  );
}
