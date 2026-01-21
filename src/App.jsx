import { useEffect, useState } from "react";
import Globe from "react-globe.gl";
import { feature } from "topojson-client";
import * as THREE from "three";

const CLEMSON = { lat: 34.6834, lng: -82.8374, name: "Clemson" };

export default function App() {
  const [countries, setCountries] = useState([]);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    fetch("https://unpkg.com/world-atlas@2/countries-110m.json")
      .then((res) => res.json())
      .then(async (world) => {
        const topojson = await import("topojson-client");
        const { features } = topojson.feature(world, world.objects.countries);
        setCountries(features);
      });
  }, []);

  const bg = darkMode ? "black" : "white";
  const globeTex = darkMode ? "/black_75.png" : "/white_75.png";

  return (
    <div style={{ width: "100vw", height: "100vh", background: bg }}>
      <button
        onClick={() => setDarkMode((v) => !v)}
        style={{
          position: "fixed",
          zIndex: 10,
          top: 12,
          left: 12
        }}
      >
        {darkMode ? "Light mode" : "Dark mode"}
      </button>

      <Globe
        globeMaterial={new THREE.MeshBasicMaterial({ map: null, color: "#0000007a" })}
        backgroundColor={bg}
        showAtmosphere={true}
        globeImageUrl={globeTex}
        polygonsData={countries}
        polygonCapColor={() => "#1e5effcf"}
        polygonSideColor={() => "#1e5eff"}
        polygonStrokeColor={() => "rgba(0,0,0,0)"}
        polygonAltitude={0.01}
        pointsData={[CLEMSON]}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => "#ff7a00"}
        pointRadius={0.4}
        pointAltitude={0.04}
        pointLabel="name"
      />
    </div>
  );
}
