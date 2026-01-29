## Project structure

```text
src/
├── App.jsx                   # App composition / wiring (GlobeView + Topbar)
├── hooks/                    # Custom hooks: reusable stateful logic (no UI)
│   ├── useCountryNews.js     # Fetch News API's
│   └── useGlobeCountries.js  # Shared state + country fetching + selection logic
└── components/               # React components: reusable UI building blocks
    ├── GlobeView.jsx         # react-globe.gl scene + hover/selected rendering
    ├── Topbar.jsx            # Search input + dropdown results
    └── Topbar.css            # Topbar + dropdown styling
    ├── CountryPanel.jsx      # Side panel to display information
    └── CountryPanel.css      # Side panel styling
```

Notes

    Topbar controls the search query + selection.

    GlobeView renders polygons/borders and rotates to the selected country.

    Shared state lives in useGlobeCountries and is used by both components.

Main Features

    [X] Globe Viewport
    [X] Country Selection
    [X] Country Search Bar
    [ ] Country Information Panel
