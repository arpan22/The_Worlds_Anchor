# Globe Project

A React-based 3D globe application that provides interactive country information, news, and AI-powered summaries. Users can search for countries, view them on a globe, and access detailed briefs including news and Wikipedia summaries.

## Features

- [X] 3D Globe
- [X] Country Search
- [X] Country Panel
- [X] News
- [X] Briefs
- [X] Chat
- [X] Settings
- [X] Sessions
- [X] Rate Limiting

## Project Structure

```
Globe_Project/
├── eslint.config.js          # ESLint configuration
├── index.html                # Main HTML entry point
├── LICENSE                   # Project license
├── package.json              # Frontend dependencies and scripts
├── README.md                 # Project documentation
├── test-country-news.js      # Test script for country news
├── test-wiki-summary.js      # Test script for wiki summaries
├── vite.config.js            # Vite build configuration
├── public/                   # Static assets
├── server/                   # Backend server
│   ├── index.js              # Server entry point
│   ├── package.json          # Server dependencies
│   ├── config/
│   │   └── index.js          # Server configuration
│   ├── middleware/
│   │   └── rateLimiter.js    # Rate limiting middleware
│   ├── prompts/
│   │   └── templates.js      # Prompt templates for AI
│   ├── routes/
│   │   ├── news.js           # News API routes
│   │   └── session.js        # Session management routes
│   └── services/
│       ├── briefGenerator.js # Generates country briefs
│       ├── GeminiSearchClient.js # Gemini AI client
│       ├── NemotronClient.js # Nemotron AI client
│       ├── newsService.js    # News fetching service
│       ├── ragPipeline.js    # RAG pipeline for AI
│       └── sessionManager.js # Session management service
├── src/                      # Frontend source code
│   ├── App.css               # App styles
│   ├── App.jsx               # Main App component
│   ├── index.css             # Global styles
│   ├── main.jsx              # React entry point
│   ├── assets/               # Static assets
│   ├── components/           # React components
│   │   ├── ChatPanel.css     # Chat panel styles
│   │   ├── ChatPanel.jsx     # Chat panel component
│   │   ├── CountryBrief.css  # Country brief styles
│   │   ├── CountryBrief.jsx  # Country brief component
│   │   ├── CountryPanel.css  # Country panel styles
│   │   ├── CountryPanel.jsx  # Country panel component
│   │   ├── GlobeView.jsx     # 3D globe component
│   │   ├── SettingsPanel.css # Settings panel styles
│   │   ├── SettingsPanel.jsx # Settings panel component
│   │   ├── Topbar.css        # Topbar styles
│   │   └── Topbar.jsx        # Topbar component
│   ├── hooks/                # Custom React hooks
│   │   ├── useCountryNews.js # Hook for country news
│   │   ├── useCountrySession.js # Hook for country sessions
│   │   └── useGlobeCountries.js # Hook for globe countries
│   ├── services/             # Frontend services
│   │   ├── backendApi.js     # Backend API client
│   │   ├── CountrySummary.js # Country summary service
│   │   └── newsApi.js        # News API client
│   └── utils/                # Utility functions
│       └── countryCodes.js   # Country code utilities
└── newsapis/                 # News API related files
```

## Installation

1. Clone the repository.
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Install server dependencies:
   ```bash
   npm run server:install
   ```

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```
2. In a separate terminal, start the backend server:
   ```bash
   npm run dev:server
   ```
3. Open your browser to `http://localhost:5173` (or the port shown by Vite).

## Development

- Frontend: Built with React and Vite.
- Backend: Node.js with Express.
- Globe: Uses react-globe.gl for 3D rendering.
- AI Services: Integrates with Gemini and Nemotron for summaries.

## Notes

- Topbar handles search and selection.
- GlobeView renders the globe and country polygons.
- Shared state is managed via custom hooks.
- Server provides API endpoints for news, sessions, and AI briefs.
