import GlobeView from "./components/GlobeView";
import Topbar from "./components/Topbar";
import { useGlobeCountries } from "./hooks/useGlobeCountries";

export default function App() {
  const globe = useGlobeCountries();

  return (
    <>
      <GlobeView
        ref={globe.globeRef}
        countries={globe.countries}
        selectedCountry={globe.selectedCountry}
      />

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
