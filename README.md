# SENTINEL OS v3.5 — Global Situational Awareness Platform

## Overview
SENTINEL OS is a production-grade, multi-domain global situational awareness platform inspired by Beholder.me, Palantir Gotham, and NATO Common Operating Picture (COP) systems. It aggregates 16+ live OSINT data layers from 450+ catalogued intelligence sources into a unified military-grade dark ops interface.

**Architecture**: Edge BFF (Backend-for-Frontend) on Cloudflare Workers/Pages + Hono  
**Runtime**: Zero-dependency edge runtime — no servers, no databases, pure edge compute  
**Design Language**: Palantir Gotham / NATO COP / Beholder.me dark ops aesthetic

## v3.5 New Features

### 3D WebGL Globe View
- Toggle between 2D Leaflet map and 3D Globe.gl visualization (`G` key)
- Blue Marble satellite imagery with bump mapping and atmospheric halo
- Entity points rendered at correct altitude (orbital entities elevated)
- Animated threat zone rings pulsing over geopolitical hotspots
- ISS orbit arc visualization in 3D space
- Click-to-inspect entities on the globe
- Auto-syncs with live data on every fetch cycle

### Real-Time Event Timeline
- Time-sequenced intelligence event log (`T` key to toggle)
- Automatically populates from all data feeds:
  - Emergency squawk codes (CRITICAL)
  - Nuclear/WMD intel events (CRITICAL)
  - RED alert disasters (CRITICAL)
  - M5.0+ earthquakes (HIGH)
  - Major wildfires FRP>=200 MW (HIGH)
  - Fetch cycle status updates (INFO)
- Click events to fly to entity location
- Rolling 100-event buffer with UTC timestamps

### Entity Search Engine
- Full-text search across all tracked entities (`/` or `F` key)
- Searches entity names, types, and detail fields (ICAO codes, callsigns, locations)
- Live results dropdown with threat score indicators
- Click to fly to and inspect entity

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `1-4` | Switch left panel tabs |
| `G` | Toggle 2D Map / 3D Globe |
| `Z` | Toggle threat zone overlays |
| `T` | Toggle event timeline |
| `/` or `F` | Open entity search |
| `R` | Refresh all feeds immediately |
| `H` | Home view (reset map center) |
| `Esc` | Close active panel/search |
| `?` | Show/hide keyboard shortcuts |

### Enhanced HUD Overlays
- **Compass rose** with zoom level display (bottom-right)
- **UTC Zulu clock** (bottom-left) — live real-time display
- **Stats ring** (bottom-center) — domain breakdown with labeled counts:
  - AVN (aviation), MIL (military), MAR (maritime), ORB (orbital), SIS (seismic), FIR (wildfire), INT (conflict intel), DIS (disasters)
  - Critical threat flash indicator
- **View toggle** buttons (top-right) for 2D/3D switching
- Auto-refresh every 2 seconds

## Live Data Layers (16+)

### Aviation Domain
| Layer | Source | Update Rate | Key Required |
|-------|--------|-------------|--------------|
| Aircraft (ADS-B) | OpenSky Network | 30s | No |
| Military Air | ADS-B Exchange (RapidAPI) | 30s | Yes (RAPIDAPI_KEY) |
| Aviation WX (SIGMETs) | AVWX REST API | 30s | Yes (AVWX_KEY) |

### Maritime Domain
| Layer | Source | Update Rate | Key Required |
|-------|--------|-------------|--------------|
| Fishing Activity | Global Fishing Watch | 30s | Yes (GFW_TOKEN) |
| Dark Fleet (AIS Gaps) | Global Fishing Watch | 30s | Yes (GFW_TOKEN) |

### Orbital/Space Domain
| Layer | Source | Update Rate | Key Required |
|-------|--------|-------------|--------------|
| ISS Position | wheretheiss.at | 5s | No |
| Satellites | N2YO + CelesTrak (SGP4) | 3min | Yes (N2YO_KEY) |
| Space Debris | CelesTrak TLE (SGP4) | 3min | No |
| Military Satellites | CelesTrak Military | 3min | No |

### Environmental Domain
| Layer | Source | Update Rate | Key Required |
|-------|--------|-------------|--------------|
| Seismic Events | USGS Earthquake API | 30s | No |
| Wildfires (VIIRS) | NASA FIRMS | 30s | Yes (NASA_FIRMS_KEY) |
| Storm Systems | OpenWeatherMap | 30s | Yes (OWM_KEY) |

### Geopolitical/Intel Domain
| Layer | Source | Update Rate | Key Required |
|-------|--------|-------------|--------------|
| Conflict Intel | GDELT 2.0 Articles (geocoded) | 30s | No |
| Disasters | GDACS UN OCHA | 30s | No |
| Cyber Threats | GDELT Cyber Articles | 30s | No |
| Nuclear Intel | GDELT Nuclear Monitoring | 30s | No |

## Architecture

```
Browser ──→ Cloudflare Edge Worker (Hono BFF)
               ├── /api/proxy ──→ OpenSky, GDACS, FIRMS, N2YO, GFW, ADS-B Exchange...
               ├── /api/intel/gdelt ──→ GDELT 2.0 Article API → Server-side geocoding
               ├── /api/fusion/zones ──→ Geopolitical zone definitions
               ├── /api/health ──→ System health (v3.5.0)
               ├── /api/status ──→ API key status
               ├── /static/* ──→ CSS + JS (CDN-optimized)
               └── / ──→ Main HTML (inline, loads Globe.gl + Three.js + Leaflet + satellite.js)
```

## Key Features

### Threat Assessment Engine
- Multi-factor scoring: squawk codes, entity type, seismic magnitude, wildfire FRP, proximity to 15 geopolitical zones
- Threat levels: CRITICAL (75+), HIGH (50+), MEDIUM (28+), LOW (10+), MINIMAL (0+)
- Real-time threat board with top 50 highest-scored entities

### Geopolitical Zones (15)
Ukraine/Russia Front, Gaza Strip, Iran Theater, Red Sea/Houthi Zone, Strait of Hormuz, Taiwan Strait, South China Sea, Korean Peninsula, Sudan Civil War, Kashmir LOC, Black Sea NATO Watch, Sahel Insurgency, Horn of Africa, Baltic NATO Frontier, Arctic GIUK Gap

### Military Intelligence
- Squawk code detection: 7500 (Hijack), 7600 (Comms Failure), 7700 (Emergency), 7777 (MIL Intercept), 7400 (UAV Lost Link)
- Military callsign database: 25+ prefix patterns (RCH, REACH, JAKE, NATO, GHOST, VIPER, BRONC, DUKE, etc.)
- Aircraft type identification: C-17, B-2, F-22, P-8A, RC-135, E-4B, AC-130J, etc.

### Multi-Domain Fusion
- Cross-domain correlation engine
- Zone activity monitoring
- Domain breakdown statistics
- Cycle-based data refresh (30s intervals)

### GDELT Article-Based Intelligence
- Server-side geocoding of GDELT news articles using 61-entry geopolitical database
- Categories: conflict, maritime, nuclear, cyber
- Transforms article titles into geo-located intelligence events

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /` | GET | Main dashboard HTML |
| `GET /api/health` | GET | System health status |
| `GET /api/status` | GET | API key configuration status |
| `POST /api/proxy` | POST | Proxy to upstream APIs (body: `{target, params}`) |
| `POST /api/intel/gdelt` | POST | GDELT article geocoding (body: `{category}`) |
| `GET /api/fusion/zones` | GET | Geopolitical zone definitions |

## Environment Variables

For production deployment, set these as Cloudflare secrets:

```
NASA_FIRMS_KEY    # NASA FIRMS wildfire data
OWM_KEY           # OpenWeatherMap weather data
N2YO_KEY          # N2YO satellite tracking
GFW_TOKEN         # Global Fishing Watch maritime data
AVWX_KEY          # AVWX aviation weather SIGMETs
RAPIDAPI_KEY      # ADS-B Exchange military aircraft
```

## Tech Stack
- **Backend**: Hono v4 (Cloudflare Pages edge runtime)
- **Frontend**: Vanilla JS (zero-framework, pure DOM manipulation)
- **2D Map**: Leaflet 1.9.4 + MarkerCluster
- **3D Globe**: Globe.gl + Three.js (WebGL)
- **Orbital**: satellite.js (SGP4 propagation)
- **Fonts**: JetBrains Mono + Orbitron + Inter
- **Build**: Vite + Wrangler
- **Deployment**: Cloudflare Pages

## Development

```bash
npm run build              # Build for production
npm run dev:sandbox        # Dev server on port 3000
pm2 start ecosystem.config.cjs  # Start with PM2
```

## Deployment Status
- **Platform**: Cloudflare Pages (Edge Runtime)
- **Status**: Active
- **Version**: 3.5.0
- **Last Updated**: 2026-03-24

## User Guide
1. Open the platform URL in a modern browser
2. The 2D satellite map loads automatically with all active data layers
3. Press `G` to switch to 3D globe view
4. Use left panel tabs (LAYERS / THREAT / FUSION / APIS) to inspect data
5. Press `/` to search for any entity by name, callsign, or ICAO code
6. Press `T` to open the real-time event timeline
7. Click any marker to open the entity inspector (right panel)
8. Toggle threat zone overlays with `Z`
9. Press `?` for full keyboard shortcut reference

## Next Steps
- AISStream.io real-time maritime AIS streaming
- ACLED conflict event API integration
- Server-Sent Events (SSE) for sub-second push updates
- CesiumJS integration for terrain-accurate 3D
- JWT multi-tenant authentication
- Cloudflare D1 for persistent storage and event archiving
- PDF/CSV export and reporting
