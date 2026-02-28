import "./App.css";
import GlobeView from "./components/GlobeView";
import Topbar from "./components/Topbar";
import { useGlobeCountries } from "./hooks/useGlobeCountries";
import { useCountryEvents } from "./hooks/useCountryEvents";
import { useCountrySession } from "./hooks/useCountrySession";
import CountryPanel from "./components/CountryPanel";
import WarProtestView from "./components/WarProtest/WarProtestView";
import MarketPanel from "./components/MarketPanel";
import TrendsPanel from "./components/TrendsPanel";

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
  const [showIntro, setShowIntro] = useState(true);
  const [isIntroReady, setIsIntroReady] = useState(false);
  const [introHasError, setIntroHasError] = useState(false);

  const globe = useGlobeCountries();
  const [eventFilters, setEventFilters] = useState({ dateRange: '7d', tone: 'all', eventType: 'Economy' });
  const [isTrendsOpen, setIsTrendsOpen] = useState(false);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const events = useCountryEvents(globe.selectedCountry, eventFilters);
  const session = useCountrySession(globe.selectedCountry);

  const panelOpen = Boolean(globe.selectedCountry || isMarketOpen || isTrendsOpen);

  const globeWidth = panelOpen ? Math.floor(window.innerWidth * 0.5) : window.innerWidth;
  const globeHeight = window.innerHeight;

  const newsBriefing = buildNewsBriefing(globe.selectedCountry, session.brief);

  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [panelOpen]);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
    if (view === 'globe') {
      // keep existing selection
    }
  }, []);

  return (
    <>
      {showIntro && (
        <div
          className={`intro-overlay ${isIntroReady ? "intro-overlay--ready" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Enter website"
          onClick={() => setShowIntro(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setShowIntro(false);
            }
          }}
        >
          <video
            className="intro-overlay__video"
            src="/globewithtitle.mov"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => setIsIntroReady(true)}
            onLoadedData={() => setIsIntroReady(true)}
            onError={() => setIntroHasError(true)}
          />
          <div className="intro-overlay__hint">
            {introHasError ? 'Video failed to load. Click anywhere to continue' : 'Click anywhere to enter'}
          </div>
        </div>
      )}

      {!showIntro && (
        <Topbar
          value={globe.searchQuery}
          onChange={globe.setSearchQuery}
          results={globe.filteredCountries}
          isOpen={globe.isDropdownOpen}
          setIsOpen={globe.setIsDropdownOpen}
          onSelectCountry={(country) => {
            setIsMarketOpen(false);
            setIsTrendsOpen(false);
            globe.handleSelectCountry(country);
          }}
          activeView={activeView}
          onViewChange={handleViewChange}
          isTrendsOpen={isTrendsOpen}
          onToggleTrends={() => {
            setIsTrendsOpen((prev) => {
              const next = !prev;
              if (next) {
                setIsMarketOpen(false);
                globe.clearSelection();
              }
              return next;
            });
          }}
          isMarketsOpen={isMarketOpen}
          onToggleMarkets={() => {
            setIsMarketOpen((prev) => {
              const next = !prev;
              if (next) {
                setIsTrendsOpen(false);
                globe.clearSelection();
              }
              return next;
            });
          }}
        />
      )}

      {!showIntro && activeView === 'globe' && (
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
              {globe.selectedCountry ? (
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
              ) : (
                <>
                  {isMarketOpen && <MarketPanel onClose={() => setIsMarketOpen(false)} />}
                  {isTrendsOpen && <TrendsPanel onClose={() => setIsTrendsOpen(false)} />}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!showIntro && activeView === 'warprotest' && <WarProtestView />}
    </>
  );
}
