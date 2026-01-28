import GlobeView from "./components/GlobeView";
import Topbar from "./components/Topbar";
import { useGlobeCountries } from "./hooks/useGlobeCountries";
import { useCountryNews } from "./hooks/useCountryNews";
import CountryPanel from "./components/CountryPanel";


export default function App() {
  const globe = useGlobeCountries();

  // Fetch news when a country is selected
  const news = useCountryNews(globe.selectedCountry);

  return (
    <>
        <GlobeView
          ref={globe.globeRef}
          countries={globe.countries}
          selectedCountry={globe.selectedCountry}
          onSelectCountry={globe.handleSelectCountry}
          onClearSelection={globe.clearSelection}
        />

      <Topbar
        value={globe.searchQuery}
        onChange={globe.setSearchQuery}
        results={globe.filteredCountries}
        isOpen={globe.isDropdownOpen}
        setIsOpen={globe.setIsDropdownOpen}
        onSelectCountry={globe.handleSelectCountry}
      />

      <CountryPanel
        country={globe.selectedCountry}
        onClose={globe.clearSelection}
        articles={news.articles}
        isLoading={news.isLoading}
        error={news.error}
        onRefresh={news.refresh}
      />
    </>
  );
}
