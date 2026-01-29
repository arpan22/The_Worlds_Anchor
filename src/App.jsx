import "./App.css";
import GlobeView from "./components/GlobeView";
import Topbar from "./components/Topbar";
import { useGlobeCountries } from "./hooks/useGlobeCountries";
import { useCountryNews } from "./hooks/useCountryNews";
import CountryPanel from "./components/CountryPanel";

import { useEffect, useState } from "react";
import { fetchCountrySummary } from "./services/CountrySummary";


export default function App() {
  const globe = useGlobeCountries();
  const news = useCountryNews(globe.selectedCountry);

  const panelOpen = Boolean(globe.selectedCountry);

    
  const globeWidth = panelOpen ? Math.floor(window.innerWidth * 0.5) : window.innerWidth;
  const globeHeight = window.innerHeight;

  const [countrySummary, setCountrySummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);

  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [panelOpen]);


 useEffect(() => {
    let ignore = false;

    async function run() {
      if (!globe.selectedCountry) {
        setCountrySummary(null);
        setSummaryError(null);
        return;
      }

      try {
        setSummaryError(null);
        const summary = await fetchCountrySummary(globe.selectedCountry);
        if (!ignore) setCountrySummary(summary);
      } catch (e) {
        if (!ignore) {
          setCountrySummary(null);
          setSummaryError(e?.message ?? "Failed to load summary");
        }
      }
    }

    run();
    return () => {
      ignore = true;
    };
  }, [globe.selectedCountry]);
  // useEffect dependency array controls when the side effect re-runs [web:73]



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
              countrySummary={summaryError ?? countrySummary}
              onClose={globe.clearSelection}
              articles={news.articles}
              isLoading={news.isLoading}
              error={news.error}
              onRefresh={news.refresh}
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
    </>
  );
}