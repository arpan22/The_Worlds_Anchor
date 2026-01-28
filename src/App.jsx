import GlobeView from "./components/GlobeView";
import Topbar from "./components/Topbar";
import { useGlobeCountries } from "./hooks/useGlobeCountries";
import CountryPanel from "./components/CountryPanel";


export default function App() {
  const globe = useGlobeCountries();

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
      />
    </>
  );
}
