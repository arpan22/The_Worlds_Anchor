import { useEffect, useState } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

export default function App() {
  const [countries, setCountries] = useState([]);
  const [hoveredCountry, setHoveredCountry] = useState(null);

  useEffect(() => {
    fetch("https://unpkg.com/world-atlas@2/countries-110m.json")
      .then((res) => res.json())
      .then(async (world) => {
        const topojson = await import("topojson-client");
        const { features } = topojson.feature(world, world.objects.countries);
        setCountries(features);
      });
  }, []);

  const handleCountryHover = (polygon) => {
    setHoveredCountry(polygon);
  };

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "#000000"
    }}>
      <Globe
        globeMaterial={new THREE.MeshBasicMaterial({ color: "#ffffff" })}
        globeImageUrl=""
        backgroundImageUrl=""

        polygonsData={countries}
        polygonCapColor={(d) => d === hoveredCountry ? "#ff6600" : "#3b82f6"}
        polygonSideColor={(d) => d === hoveredCountry ? "#ff8833" : "#2563eb"}
        polygonStrokeColor={(d) => d === hoveredCountry ? "#ff6600" : "#000000"}
        polygonStrokeWidth={(d) => d === hoveredCountry ? 8 : 5}
        polygonAltitude={(d) => d === hoveredCountry ? 0.04 : 0.01}
        onPolygonHover={handleCountryHover}
        polygonsTransitionDuration={200}
        polygonLabel={(d) => `<b>${d.properties.name}</b>`}
      />
    </div>
  );
}
