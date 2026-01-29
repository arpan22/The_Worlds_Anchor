import { forwardRef, useMemo, useState } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

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
      ring.length &&
      (ring[0][0] !== ring[ring.length - 1][0] ||
        ring[0][1] !== ring[ring.length - 1][1])
        ? [...ring, ring[0]]
        : ring;

    return {
      country: countryFeature,
      points: closedRing.map(([lng, lat]) => ({ lat, lng })),
    };
  });
}

const GlobeView = forwardRef(function GlobeView(
  { countries, selectedCountry, onSelectCountry, onClearSelection, width, height },
  globeRef
) {
  const [hoveredCountry, setHoveredCountry] = useState(null);

  const globeMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#000d2a" }),
    []
  );

  const borderPaths = useMemo(() => {
    return countries.flatMap(countryToBorderPaths);
  }, [countries]);

  // Get color based on state: selected (orange) takes priority over hover (cyan)
  const getCapColor = (d) => {
    if (d === selectedCountry) return "#f07f16"; // Orange for selected
    if (d === hoveredCountry) return "#2a788b";  // Cyan for hover
    return "#164753";                             // Default
  };

  const getSideColor = (d) => {
    if (d === selectedCountry) return "#b86c25"; // Dark orange for selected
    if (d === hoveredCountry) return "#1e5a6a";  // Dark cyan for hover
    return "#0f323b";                             // Default
  };

  const getBorderColor = (d) => {
    if (d === selectedCountry) return "#f59542"; // Light orange for selected
    if (d === hoveredCountry) return "#206475";  // Teal for hover
    return "#a8a8a8";                             // Default gray
  };

  const isHighlighted = (d) => d === hoveredCountry || d === selectedCountry;

  return (
    <div style={{ width: "100%", height: "100%", background: "#000000" }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        globeMaterial={globeMat}
        globeImageUrl=""
        backgroundImageUrl=""

        // Filled countries
        polygonsData={countries}
        polygonCapColor={getCapColor}
        polygonSideColor={getSideColor}
        polygonStrokeColor={() => null} // disable built-in stroke
        polygonAltitude={(d) => (isHighlighted(d) ? 0.05 : 0.01)}
        onPolygonHover={setHoveredCountry}
        onPolygonClick={(country, event) => {
          onSelectCountry?.(country);
          event?.stopPropagation?.();
        }}
        onGlobeClick={() => {
          onClearSelection?.();
        }}
        polygonsTransitionDuration={200}
        polygonLabel={(d) => `<b>${d.properties.name}</b>`}

        // Borders as paths (thick lines)
        pathsData={borderPaths}
        pathPoints={(p) => p.points} // points are {lat, lng} objects
        pathPointLat={(pt) => pt.lat} // override defaults
        pathPointLng={(pt) => pt.lng} // override defaults
        pathColor={(p) => getBorderColor(p.country)}
        pathStroke={(p) => (isHighlighted(p.country) ? 2.5 : 1.0)} // angular degrees
        pathPointAlt={0.012} // lift borders slightly to reduce z-fighting
        pathsTransitionDuration={200}
      />
    </div>
  );
});

export default GlobeView;
