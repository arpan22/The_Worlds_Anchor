# Globe Project

A React-based 3D globe application that provides interactive country information, news, and AI-powered analysis. Click any country on the globe to open a panel showing live news events, AI-generated briefs, charts, timelines, and a RAG-grounded chat.

## Features

- [X] 3D Globe
- [X] Country Search
- [X] Country Panel (Events / Filters / AI Analysis tabs)
- [X] GDELT News Events (free, no API key, 200+ countries)
- [X] Event Filters (date range, tone, event type)
- [X] AI Country Brief (NVIDIA Nemotron)
- [X] AI-Generated Bar Chart (Recharts)
- [X] AI-Generated Event Timeline
- [X] RAG-Grounded Chat (Nemotron + Gemini fallback)
- [X] Settings
- [X] Sessions
- [X] Rate Limiting

## Architecture

```
[User clicks country]
        ↓
[GET /api/events] → gdeltService.js → GDELT Doc API (free)
        ↓
[POST /api/country-session] → briefGenerator.js
  ├── fetchCountryEvents (GDELT articles)
  ├── dedupe → chunk → NVIDIA embeddings → vector index
  └── Nemotron → country brief (bullets, narrative, topics)
        ↓
[POST /session/:id/graph]     → Nemotron → Recharts JSON
[POST /session/:id/timeline]  → Nemotron → timeline JSON
[POST /session/:id/chat]      → RAG retrieve → Nemotron (SSE stream)
  └── low-confidence fallback → Gemini web search → Nemotron
```

## Project Structure

```
Globe_Project/
├── index.html
├── package.json              # Frontend dependencies
├── vite.config.js
├── server/
│   ├── index.js              # Express entry point
│   ├── package.json          # Server dependencies
│   ├── config/
│   │   └── index.js          # Centralized config (ports, model names, token budgets)
│   ├── middleware/
│   │   └── rateLimiter.js
│   ├── prompts/
│   │   └── templates.js      # All Nemotron prompt templates
│   ├── routes/
│   │   ├── events.js         # GET /api/events (GDELT proxy)
│   │   └── session.js        # Session lifecycle + graph/timeline/chat endpoints
│   └── services/
│       ├── gdeltService.js   # GDELT Doc API fetcher, cache, relevance filter
│       ├── briefGenerator.js # Orchestrates RAG pipeline → Nemotron brief
│       ├── ragPipeline.js    # Chunk, embed, vector search
│       ├── NemotronClient.js # NVIDIA NIM chat completions + embeddings
│       ├── GeminiSearchClient.js # Gemini web-grounded search (fallback only)
│       └── sessionManager.js # In-memory session store with TTL
└── src/
    ├── App.jsx               # Root: wires hooks → CountryPanel
    ├── components/
    │   ├── GlobeView.jsx     # react-globe.gl 3D rendering
    │   ├── Topbar.jsx        # Search bar
    │   ├── CountryPanel.jsx  # Tabbed side panel (Events / Filters / AI Analysis)
    │   ├── CountryBrief.jsx  # Brief + Recharts bar chart + timeline
    │   ├── ChatPanel.jsx     # Streaming RAG chat UI
    │   └── SettingsPanel.jsx
    ├── hooks/
    │   ├── useCountryEvents.js   # Fetches GDELT events, re-fetches on filter change
    │   ├── useCountrySession.js  # Session lifecycle, graph/timeline generation
    │   └── useGlobeCountries.js  # GeoJSON country data for the globe
    ├── services/
    │   ├── backendApi.js         # All fetch calls to Express backend
    │   └── CountrySummary.js     # Wikipedia summary fetcher
    └── utils/
        └── countryCodes.js       # ISO-2 lookup, GDELT support check
```

## Environment Variables

Create a `.env` file in the project root:

```env
NVIDIA_API_KEY=your_nvidia_api_key
GEMINI_API_KEY=your_gemini_api_key

# Optional overrides (defaults shown)
PORT=3001
NIM_ENDPOINT=https://integrate.api.nvidia.com/v1
NEMOTRON_MODEL=nvidia/llama-3.3-nemotron-super-49b-v1
NVIDIA_EMBED_MODEL=nvidia/nv-embedqa-e5-v5
GEMINI_MODEL=gemini-2.0-flash
```

GDELT requires no API key — it is a free public dataset.

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

1. Start the backend:
   ```bash
   npm run dev:server
   ```
2. In a separate terminal, start the frontend:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` and click any country on the globe.

## How It Works

### News Events (GDELT)
Country events are fetched from the [GDELT Project](https://www.gdeltproject.org/) Doc 2.0 API — a free, real-time global news database covering 200+ countries with no authentication required. Results are filtered to articles whose title directly references the country (by name, demonym, or capital) to reduce off-topic results. Responses are cached server-side for 8 minutes.

The Events tab shows articles sorted by recency. The Filters tab lets you narrow by date range (24h / 3d / 7d / 30d), tone (positive / neutral / negative), and event type (Politics, Military, Economy, Diplomacy, Environment, Society).

### AI Brief (Nemotron)
When a country is selected, the backend opens a session that runs the full RAG pipeline:
1. Fetches up to 30 recent articles from GDELT
2. Deduplicates and chunks article text
3. Generates embeddings via NVIDIA NIM
4. Builds an in-memory vector index
5. Prompts Nemotron to produce a structured brief: bullet points, narrative summary, and topic clusters

### Graph & Timeline
On demand (via buttons in the AI Analysis tab), Nemotron receives the brief and article list and returns:
- **Graph** — a Recharts-compatible bar chart of event categories (Politics, Economy, etc.) specific to that country
- **Timeline** — a chronological list of key events extracted from the articles, with tone labels

### RAG Chat
The chat box in the AI Analysis tab queries the session's vector index to retrieve the most relevant article chunks, then prompts Nemotron to answer using only those sources. If confidence is low, a Gemini web search provides supplementary context — but Nemotron always produces the final answer.

## Development

- Frontend: React + Vite
- Backend: Node.js + Express (ES modules)
- Globe: react-globe.gl
- Charts: Recharts
- Primary AI: NVIDIA Nemotron (via NIM API) — brief, embeddings, graph, timeline, chat
- Fallback AI: Google Gemini — web-grounded search context only
