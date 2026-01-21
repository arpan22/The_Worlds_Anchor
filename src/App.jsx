import { useEffect, useState } from "react";
import Globe from "react-globe.gl";

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
    <div style={{ width: "100vw", height: "100vh", background: "#f0f0f0" }}>
      <Globe
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
        backgroundColor="#f0f0f0"

        polygonsData={countries}
        polygonCapColor={(d) => d === hoveredCountry ? "rgba(255, 100, 0, 0.3)" : "rgba(0, 0, 0, 0)"}
        polygonSideColor={(d) => d === hoveredCountry ? "rgba(255, 100, 0, 0.5)" : "rgba(0, 0, 0, 0)"}
        polygonStrokeColor={(d) => d === hoveredCountry ? "#ff6600" : "#000000"}
        polygonStrokeWidth={(d) => d === hoveredCountry ? 8 : 5}
        polygonAltitude={(d) => d === hoveredCountry ? 0.15 : 0.001}
        onPolygonHover={handleCountryHover}
        polygonsTransitionDuration={200}
        polygonLabel={(d) => `<b>${d.properties.name}</b>`}
      />
    </div>
  );
}
