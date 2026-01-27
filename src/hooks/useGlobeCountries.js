import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";

// Calculate the centroid (center point) of a country for globe rotation
function getCountryCentroid(countryFeature) {
  const geom = countryFeature.geometry;
  if (!geom) return { lat: 0, lng: 0 };

  let allCoords = [];
  if (geom.type === "Polygon") {
    allCoords = geom.coordinates[0];
  } else if (geom.type === "MultiPolygon") {
    allCoords = geom.coordinates.flat(2);
  }

  if (allCoords.length === 0) return { lat: 0, lng: 0 };

  const sumLng = allCoords.reduce((sum, coord) => sum + coord[0], 0);
  const sumLat = allCoords.reduce((sum, coord) => sum + coord[1], 0);

  return {
    lng: sumLng / allCoords.length,
    lat: sumLat / allCoords.length,
  };
}

export function useGlobeCountries() {
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const globeRef = useRef(null);

  useEffect(() => {
    fetch("https://unpkg.com/world-atlas@2/countries-110m.json")
      .then((res) => res.json())
      .then((world) => {
        const { features } = feature(world, world.objects.countries);
        setCountries(features);
      });
  }, []);

  // Sort countries alphabetically and filter by search query
  const sortedCountries = useMemo(() => {
    return [...countries]
      .filter((c) => c.properties?.name)
      .sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  }, [countries]);

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return sortedCountries;
    return sortedCountries.filter((c) =>
      c.properties.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sortedCountries, searchQuery]);

  // Handle country selection from dropdown
  const handleSelectCountry = useCallback((country) => {
    setSelectedCountry(country);
    setSearchQuery(country.properties.name);
    setIsDropdownOpen(false);

    // Rotate globe to the selected country
    if (globeRef.current) {
      const { lat, lng } = getCountryCentroid(country);
      globeRef.current.pointOfView({ lat, lng, altitude: 2 }, 1000);
    }
  }, []);

  return {
    countries,
    selectedCountry,
    setSelectedCountry,

    searchQuery,
    setSearchQuery,

    isDropdownOpen,
    setIsDropdownOpen,

    filteredCountries,

    globeRef,
    handleSelectCountry,
  };
}
