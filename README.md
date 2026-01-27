## Project structure

```text
src/
├── App.jsx                  # App composition / wiring (GlobeView + Topbar)
├── hooks/                   # Custom hooks: reusable stateful logic (no UI)
│   └── useGlobeCountries.js  # Shared state + country fetching + selection logic
└── components/              # React components: reusable UI building blocks
    ├── GlobeView.jsx         # react-globe.gl scene + hover/selected rendering
    ├── Topbar.jsx            # Search input + dropdown results
    └── Topbar.css            # Topbar + dropdown styling
```

Notes

    Topbar controls the search query + selection.

    GlobeView renders polygons/borders and rotates to the selected country.

    Shared state lives in useGlobeCountries and is used by both components.
