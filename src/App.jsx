import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";


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
    lat: sumLat / allCoords.length
  };
}

// The built-in polygon stroke method caused a bunch of z fighting (flickering), so this function stops that from happening while achieving the same look.
function countryToBorderPaths(countryFeature) {
  const geom = countryFeature.geometry;
  if (!geom) return [];

  // Returns array of rings, each ring is an array of [lng, lat] points
  const rings =
    geom.type === "Polygon"
      ? geom.coordinates
      : geom.type === "MultiPolygon"
      ? geom.coordinates.flat()
      : [];

  // Convert each ring into a path object (close the ring if needed)
  return rings.map((ring) => {
    const closedRing =
      ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
        ? [...ring, ring[0]]
        : ring;

    return {
      country: countryFeature,
      points: closedRing.map(([lng, lat]) => ({ lat, lng }))
    };
  });
}

export default function App() {
  const [countries, setCountries] = useState([]);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const globeRef = useRef();
  const dropdownRef = useRef();

  useEffect(() => {
    fetch("https://unpkg.com/world-atlas@2/countries-110m.json")
      .then((res) => res.json())
      .then(async (world) => {
        const topojson = await import("topojson-client");
        const { features } = topojson.feature(world, world.objects.countries);
        setCountries(features);
      });
  }, []);

  const borderPaths = useMemo(() => {
    return countries.flatMap(countryToBorderPaths);
  }, [countries]);

  // Sort countries alphabetically and filter by search query
  const sortedCountries = useMemo(() => {
    return [...countries]
      .filter((c) => c.properties.name)
      .sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  }, [countries]);

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return sortedCountries;
    return sortedCountries.filter((c) =>
      c.properties.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sortedCountries, searchQuery]);

  // Handle country selection from dropdown
  const handleCountrySelect = useCallback((country) => {
    setSelectedCountry(country);
    setSearchQuery(country.properties.name);
    setIsDropdownOpen(false);

    // Rotate globe to the selected country
    if (globeRef.current) {
      const { lat, lng } = getCountryCentroid(country);
      globeRef.current.pointOfView({ lat, lng, altitude: 2 }, 1000);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isHighlighted = (d) => d === hoveredCountry || d === selectedCountry;

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000000" }}>
      {/* Country Search Dropdown */}
      <div
        ref={dropdownRef}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          zIndex: 1000,
          width: "280px",
        }}
      >
        <input
          type="text"
          placeholder="Search for a country..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsDropdownOpen(true);
            if (!e.target.value) setSelectedCountry(null);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: "14px",
            border: "1px solid #2a788b",
            borderRadius: isDropdownOpen && filteredCountries.length > 0 ? "8px 8px 0 0" : "8px",
            background: "rgba(0, 13, 42, 0.9)",
            color: "#ffffff",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {isDropdownOpen && filteredCountries.length > 0 && (
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              background: "rgba(0, 13, 42, 0.95)",
              border: "1px solid #2a788b",
              borderTop: "none",
              borderRadius: "0 0 8px 8px",
            }}
          >
            {filteredCountries.map((country) => (
              <div
                key={country.properties.name}
                onClick={() => handleCountrySelect(country)}
                style={{
                  padding: "10px 16px",
                  cursor: "pointer",
                  color: country === selectedCountry ? "#2a788b" : "#ffffff",
                  background: country === selectedCountry ? "rgba(42, 120, 139, 0.2)" : "transparent",
                  borderBottom: "1px solid rgba(42, 120, 139, 0.3)",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.target.style.background = "rgba(42, 120, 139, 0.3)")}
                onMouseLeave={(e) => (e.target.style.background = country === selectedCountry ? "rgba(42, 120, 139, 0.2)" : "transparent")}
              >
                {country.properties.name}
              </div>
            ))}
          </div>
        )}
      </div>

      <Globe
        ref={globeRef}
        globeMaterial={new THREE.MeshBasicMaterial({ color: "#000d2a" })}
        globeImageUrl=""
        backgroundImageUrl=""

        // Filled countries
        polygonsData={countries}
        polygonCapColor={(d) => (isHighlighted(d) ? "#2a788b" : "#164753")}
        polygonSideColor={(d) => (isHighlighted(d) ? "#2a788b" : "#0f323b")}
        polygonStrokeColor={() => null}  // disable built-in stroke
        polygonAltitude={(d) => (isHighlighted(d) ? 0.05 : 0.01)}
        onPolygonHover={setHoveredCountry}
        polygonsTransitionDuration={200}
        polygonLabel={(d) => `<b>${d.properties.name}</b>`}

        // Borders as paths (thick lines)
        pathsData={borderPaths}
        pathPoints={(p) => p.points}
        pathPointLat={(pt) => pt.lat}
        pathPointLng={(pt) => pt.lng}
        pathColor={(p) => (isHighlighted(p.country) ? "#206475" : "#a8a8a8")}
        pathStroke={(p) => (isHighlighted(p.country) ? 2.5 : 1.0)}
        pathPointAlt={0.012}
        pathsTransitionDuration={200}
      />
    </div>
  );
}
