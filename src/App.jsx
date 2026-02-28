import "./App.css";
import GlobeView from "./components/GlobeView";
import Topbar from "./components/Topbar";
import { useGlobeCountries } from "./hooks/useGlobeCountries";
import { useCountryEvents } from "./hooks/useCountryEvents";
import { useCountrySession } from "./hooks/useCountrySession";
import CountryPanel from "./components/CountryPanel";
import WarProtestView from "./components/WarProtest/WarProtestView";

import { useEffect, useState, useCallback } from "react";

function buildNewsBriefing(country, brief) {
  if (!brief) return '';

  const countryName = country?.properties?.name || 'Selected country';
  const lines = [`Country: ${countryName}`];

  if (Array.isArray(brief.bullets) && brief.bullets.length > 0) {
    brief.bullets.forEach((bullet, index) => {
      lines.push(`[${index + 1}] ${bullet}`);
    });
  }

  if (brief.narrative) {
    lines.push(`Summary: ${brief.narrative}`);
  }

  if (Array.isArray(brief.topics) && brief.topics.length > 0) {
    brief.topics.forEach((topic, index) => {
      lines.push(`[T${index + 1}] ${topic.name}: ${topic.description}`);
    });
  }

  return lines.join('\n').slice(0, 4000);
}

export default function App() {
  // Top-level view: 'globe' (country search) or 'warprotest'
  const [activeView, setActiveView] = useState('globe');

  const globe = useGlobeCountries();
  const [eventFilters, setEventFilters] = useState({ dateRange: '7d', tone: 'all', eventType: 'Economy' });
  const events = useCountryEvents(globe.selectedCountry, eventFilters);
  const session = useCountrySession(globe.selectedCountry);

  const panelOpen = Boolean(globe.selectedCountry);

  const globeWidth = panelOpen ? Math.floor(window.innerWidth * 0.5) : window.innerWidth;
  const globeHeight = window.innerHeight;

  const newsBriefing = buildNewsBriefing(globe.selectedCountry, session.brief);

  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [panelOpen]);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
    // Clear country selection when switching to globe view for a clean state
    if (view === 'globe') {
      // keep existing selection
    }
  }, []);

  return (
    <>
      <Topbar
        value={globe.searchQuery}
        onChange={globe.setSearchQuery}
        results={globe.filteredCountries}
        isOpen={globe.isDropdownOpen}
        setIsOpen={globe.setIsDropdownOpen}
        onSelectCountry={globe.handleSelectCountry}
        activeView={activeView}
        onViewChange={handleViewChange}
      />

      {activeView === 'globe' && (
        <div className={`layout ${panelOpen ? "layout--panel-open" : ""}`}>
          <div className="layout__globe">
            <GlobeView
              ref={globe.globeRef}
              countries={globe.countries}
              selectedCountry={globe.selectedCountry}
              onSelectCountry={globe.handleSelectCountry}
              onClearSelection={globe.clearSelection}
              width={globeWidth}
              height={globeHeight}
            />
          </div>

          {panelOpen && (
            <div className="layout__panel">
              <CountryPanel
                country={globe.selectedCountry}
                onClose={globe.clearSelection}
                articles={events.articles}
                toneSeries={events.toneSeries}
                isLoading={events.isLoading}
                error={events.error}
                onRefresh={events.refresh}
                eventFilters={eventFilters}
                onFiltersChange={setEventFilters}
                countryInfo={events.countryInfo}
                // Nemotron session props
                sessionStatus={session.sessionStatus}
                brief={session.brief}
                sessionError={session.error}
                newsBriefing={newsBriefing}
                graphData={session.graphData}
                timelineData={session.timelineData}
                isGeneratingGraph={session.isGeneratingGraph}
                isGeneratingTimeline={session.isGeneratingTimeline}
                onGenerateGraph={session.generateGraph}
                onGenerateTimeline={session.generateTimeline}
              />
            </div>
          )}
        </div>
      )}

      {activeView === 'warprotest' && <WarProtestView />}
    </>
  );
}
