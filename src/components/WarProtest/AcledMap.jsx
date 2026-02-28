/**
 * AcledMap — Leaflet map for ACLED conflict/protest events
 *
 * Supports two data modes automatically:
 *
 *  AGGREGATE MODE (local xlsx data):
 *    Events share a country centroid. Renders one proportional bubble per
 *    country, sized by the real _event_count from the xlsx files.
 *
 *  INDIVIDUAL MODE (live ACLED API):
 *    Each event has precise lat/lng. Uses client-side grid clustering at
 *    low zoom and individual CircleMarkers at high zoom.
 *
 *  HEATMAP MODE (toggle):
 *    Large semi-transparent density circles in both data modes.
 *
 * Attribution: ACLED + OpenStreetMap/CARTO (shown via Leaflet attribution).
 */
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import './AcledMap.css';

const EVENT_COLORS = {
  Battles: '#e74c3c',
  'Explosions/Remote violence': '#e67e22',
  'Violence against civilians': '#c0392b',
  Protests: '#3498db',
  Riots: '#9b59b6',
  'Strategic developments': '#1abc9c',
  'Political Violence': '#e67e22', // local xlsx type
};
const DEFAULT_COLOR = '#e67e22';

function colorForType(type) {
  return EVENT_COLORS[type] || DEFAULT_COLOR;
}

/**
 * Detect whether events come from local xlsx data.
 * Local data events have _event_count set and all share the same lat/lng.
 */
function isAggregateData(events) {
  if (!events || events.length === 0) return false;
  return events[0]?._event_count !== undefined;
}

/**
 * Group events by lat/lng key → { lat, lng, totalEvents, totalFatalities, type, events[] }
 */
function groupByLocation(events) {
  const groups = {};
  for (const e of events) {
    if (e.latitude == null || e.longitude == null) continue;
    const key = `${e.latitude.toFixed(4)},${e.longitude.toFixed(4)}`;
    if (!groups[key]) {
      groups[key] = {
        lat: e.latitude,
        lng: e.longitude,
        totalEvents: 0,
        totalFatalities: 0,
        type: e.event_type,
        events: [],
      };
    }
    groups[key].totalEvents += e._event_count || 1;
    groups[key].totalFatalities += e.fatalities || 0;
    groups[key].events.push(e);
  }
  return Object.values(groups);
}

function separateAggregateGroups(groups) {
  const placed = [];
  const sorted = [...groups].sort((a, b) => b.totalEvents - a.totalEvents);

  for (const group of sorted) {
    let lat = group.lat;
    let lng = group.lng;
    let step = 0;

    while (step < 24) {
      const clash = placed.find((other) => {
        const dx = lng - other.lng;
        const dy = lat - other.lat;
        return Math.hypot(dx, dy) < 2.25;
      });

      if (!clash) break;

      const angle = (step * 47) * (Math.PI / 180);
      const radius = 0.55 + Math.floor(step / 3) * 0.45;
      lat = group.lat + Math.sin(angle) * radius;
      lng = group.lng + Math.cos(angle) * radius;
      step += 1;
    }

    placed.push({ ...group, lat, lng });
  }

  return placed;
}

/**
 * Grid cluster for individual (live API) events.
 */
function gridCluster(events, cellDeg) {
  const cells = {};
  for (const e of events) {
    if (e.latitude == null || e.longitude == null) continue;
    const row = Math.floor(e.latitude / cellDeg);
    const col = Math.floor(e.longitude / cellDeg);
    const key = `${row},${col}`;
    if (!cells[key]) {
      cells[key] = {
        lat: (row + 0.5) * cellDeg,
        lng: (col + 0.5) * cellDeg,
        count: 0,
        events: [],
        typeMap: {},
      };
    }
    cells[key].count++;
    cells[key].events.push(e);
    cells[key].typeMap[e.event_type] = (cells[key].typeMap[e.event_type] || 0) + 1;
  }
  return Object.values(cells).map((cell) => {
    const dominant = Object.entries(cell.typeMap).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { ...cell, dominantType: dominant };
  });
}

function cellSizeForZoom(zoom) {
  if (zoom < 4) return 5;
  if (zoom < 6) return 2;
  if (zoom < 8) return 0.5;
  return 0;
}

export default function AcledMap({ events, onSelectEvent, selectedEventId, showHeatmap, emptyMessage = '', focusCountry = '' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const [zoom, setZoom] = useState(5);
  const firstCountry = events.find((e) => e.latitude != null && e.longitude != null)?.country || null;

  // Initialize Leaflet map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    import('leaflet').then((L) => {
      const map = L.map(containerRef.current, {
        center: [20, 30],
        zoom: 5,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>' +
            ' &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>' +
            ' | <a href="https://acleddata.com" target="_blank">ACLED</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapRef.current = map;

      map.on('zoomend', () => setZoom(map.getZoom()));
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Re-render markers when data / zoom / mode changes
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    import('leaflet').then((L) => {
      layerGroupRef.current.clearLayers();
      if (!events || events.length === 0) return;

      if (showHeatmap) {
        renderHeatmap(L, layerGroupRef.current, events);
      } else if (isAggregateData(events)) {
        renderAggregateBubbles(L, layerGroupRef.current, events, onSelectEvent, selectedEventId);
      } else {
        const cellSize = cellSizeForZoom(zoom);
        if (cellSize > 0) {
          renderClusters(L, layerGroupRef.current, events, cellSize, onSelectEvent, mapRef.current);
        } else {
          renderIndividual(L, layerGroupRef.current, events, onSelectEvent, selectedEventId);
        }
      }
    });
  }, [events, zoom, showHeatmap, selectedEventId, onSelectEvent]);

  // Fly to bounds when country changes
  useEffect(() => {
    if (!mapRef.current || !events || events.length === 0) return;
    const first = events.find((e) => e.latitude != null && e.longitude != null);
    if (!first) return;

    import('leaflet').then((L) => {
      if (isAggregateData(events)) {
        if (!focusCountry) {
          const validPoints = events.filter((e) => e.latitude != null && e.longitude != null);
          const bounds = L.latLngBounds(validPoints.map((e) => [e.latitude, e.longitude]));
          mapRef.current.flyToBounds(bounds, { padding: [20, 20], maxZoom: 2, duration: 1 });
          return;
        }
        mapRef.current.flyTo([first.latitude, first.longitude], 5, { duration: 1 });
      } else {
        const validPoints = events.filter((e) => e.latitude != null && e.longitude != null);
        if (validPoints.length === 0) return;
        const bounds = L.latLngBounds(validPoints.map((e) => [e.latitude, e.longitude]));
        mapRef.current.flyToBounds(bounds, { padding: [40, 40], maxZoom: 7, duration: 1 });
      }
    });
    // Re-fly only when the country changes (first event's country)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, firstCountry, focusCountry]);

  return (
    <div className="acled-map-wrap">
      <div ref={containerRef} className="acled-map" />
      {(!events || events.length === 0) && emptyMessage && (
        <div className="acled-map__empty">
          <strong>No map events to show</strong>
          <span>{emptyMessage}</span>
        </div>
      )}

      <div className="acled-map__controls">
        {Object.entries(EVENT_COLORS)
          .filter(([k]) => k !== 'Political Violence')
          .map(([type, color]) => (
            <span key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="acled-map__legend-dot" style={{ background: color }} />
              {type}
            </span>
          ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span className="acled-map__legend-dot" style={{ background: DEFAULT_COLOR }} />
          Political Violence
        </span>
      </div>
    </div>
  );
}

// ─── Render: aggregate bubbles (local xlsx mode) ──────────────────────────────

function renderAggregateBubbles(L, layer, events, onSelectEvent, selectedEventId) {
  const groups = separateAggregateGroups(groupByLocation(events));
  const maxEvents = Math.max(...groups.map((g) => g.totalEvents), 1);

  for (const g of groups) {
    const isSelected = g.events.some((e) => e.event_id === selectedEventId);
    const color = colorForType(g.type);
    // Radius is capped small enough to keep nearby countries individually clickable.
    const t = Math.log10(g.totalEvents + 1) / Math.log10(maxEvents + 1);
    const radiusPx = 8 + t * 18;

    const circle = L.circleMarker([g.lat, g.lng], {
      radius: radiusPx,
      color: isSelected ? '#f6c453' : color,
      weight: isSelected ? 2.5 : 1.5,
      fillColor: color,
      fillOpacity: isSelected ? 0.92 : 0.58,
      opacity: isSelected ? 1 : 0.7,
    });

    circle.on('click', () => {
      // Return the most recent event (highest event_date) as the "selected" one
      const latest = [...g.events].sort((a, b) =>
        (b.event_date || '').localeCompare(a.event_date || '')
      )[0];
      onSelectEvent(latest);
    });

    circle.bindTooltip(
      `<strong>${g.events[0].country}</strong><br/>` +
        `${g.totalEvents.toLocaleString()} political violence events<br/>` +
        `${g.totalFatalities.toLocaleString()} est. fatalities`,
      { direction: 'top', className: 'acled-tooltip' }
    );

    circle.addTo(layer);
  }
}

// ─── Render: heatmap ──────────────────────────────────────────────────────────

function renderHeatmap(L, layer, events) {
  const groups = groupByLocation(events);
  const maxEvents = Math.max(...groups.map((g) => g.totalEvents), 1);

  for (const g of groups) {
    const intensity = Math.log10(g.totalEvents + 1) / Math.log10(maxEvents + 1);
    const radiusMeters = 80_000 + intensity * 600_000;
    const opacity = 0.08 + intensity * 0.45;

    L.circle([g.lat, g.lng], {
      radius: radiusMeters,
      color: 'transparent',
      fillColor: `hsl(${10 + (1 - intensity) * 50}, 90%, 55%)`,
      fillOpacity: opacity,
      interactive: false,
    }).addTo(layer);
  }
}

// ─── Render: grid clusters (live API mode, low zoom) ─────────────────────────

function renderClusters(L, layer, events, cellSize, onSelectEvent, map) {
  const cells = gridCluster(events, cellSize);

  for (const cell of cells) {
    const color = colorForType(cell.dominantType);
    const r = Math.min(8 + Math.log2(cell.count + 1) * 5, 36);

    const icon = L.divIcon({
      className: '',
      html:
        `<div class="acled-cluster" style="width:${r * 2}px;height:${r * 2}px;` +
        `background:${color};box-shadow:0 0 0 3px ${color}44">` +
        `<span>${cell.count > 999 ? '1k+' : cell.count}</span></div>`,
      iconSize: [r * 2, r * 2],
      iconAnchor: [r, r],
    });

    const marker = L.marker([cell.lat, cell.lng], { icon });
    marker.on('click', () => {
      if (cell.count === 1) {
        onSelectEvent(cell.events[0]);
      } else {
        map.setView([cell.lat, cell.lng], map.getZoom() + 2);
      }
    });
    marker.bindTooltip(
      `${cell.count} event${cell.count !== 1 ? 's' : ''}<br/>${cell.dominantType || ''}`,
      { direction: 'top', className: 'acled-tooltip' }
    );
    marker.addTo(layer);
  }
}

// ─── Render: individual markers (live API mode, high zoom) ───────────────────

function renderIndividual(L, layer, events, onSelectEvent, selectedEventId) {
  for (const e of events) {
    if (e.latitude == null || e.longitude == null) continue;

    const color = colorForType(e.event_type);
    const isSelected = e.event_id === selectedEventId;

    const circle = L.circleMarker([e.latitude, e.longitude], {
      radius: isSelected ? 9 : 6,
      color: isSelected ? '#f6c453' : color,
      weight: isSelected ? 2 : 1,
      fillColor: color,
      fillOpacity: isSelected ? 1 : 0.75,
    });

    circle.on('click', () => onSelectEvent(e));
    circle.bindTooltip(
      `<strong>${e.event_type}</strong><br/>${e.location || e.admin1 || e.country}<br/>${e.event_date}` +
        (e.fatalities ? `<br/>Fatalities: ${e.fatalities}` : ''),
      { direction: 'top', className: 'acled-tooltip' }
    );
    circle.addTo(layer);
  }
}
