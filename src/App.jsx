import "./App.css";
import GlobeView from "./components/GlobeView";
import Topbar from "./components/Topbar";
import { useGlobeCountries } from "./hooks/useGlobeCountries";
import { useCountryEvents } from "./hooks/useCountryEvents";
import { useCountrySession } from "./hooks/useCountrySession";
import CountryPanel from "./components/CountryPanel";
import SettingsPanel from "./components/SettingsPanel";

import { useEffect, useState, useCallback } from "react";

const DEFAULT_SETTINGS = {
  geminiEnabled: true,
  geminiMaxOutputTokens: 1000,
  nemotronMaxContextTokens: 4000,
  cacheDurationMinutes: 10,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem('globe_settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}


export default function App() {
  const globe = useGlobeCountries();
  const [eventFilters, setEventFilters] = useState({ dateRange: '7d', tone: 'all', eventType: 'Economy' });
  const events = useCountryEvents(globe.selectedCountry, eventFilters);

  // Settings state — persisted in localStorage
  const [settings, setSettings] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleSettingsChange = useCallback((next) => {
    setSettings(next);
    try { localStorage.setItem('globe_settings', JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const session = useCountrySession(globe.selectedCountry, settings);

  const panelOpen = Boolean(globe.selectedCountry);

  const globeWidth = panelOpen ? Math.floor(window.innerWidth * 0.5) : window.innerWidth;
  const globeHeight = window.innerHeight;

  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [panelOpen]);



  return (
    <>
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
              chatMessages={session.messages}
              isChatSending={session.isSending}
              onChatSend={session.sendMessage}
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

      <Topbar
        value={globe.searchQuery}
        onChange={globe.setSearchQuery}
        results={globe.filteredCountries}
        isOpen={globe.isDropdownOpen}
        setIsOpen={globe.setIsDropdownOpen}
        onSelectCountry={globe.handleSelectCountry}
      />

      <button
        className="settings-gear"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        &#9881;
      </button>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
