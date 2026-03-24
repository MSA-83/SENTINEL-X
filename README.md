# SENTINEL OS v4.0

## Global Multi-Domain Situational Awareness Platform

Real-time global situational awareness platform aggregating 16+ live OSINT data sources across aviation, maritime, orbital, seismic, wildfire, weather, conflict, disaster, cyber, and nuclear intelligence domains.

## Live Platform

- **Sandbox**: https://3000-imtcnhyw0xv31oywd9i92-dfc00ec5.sandbox.novita.ai
- **GitHub**: https://github.com/MSA-83/SENTINEL-X

## Features

### Live Data Layers (16+)

| Layer | Source | Status | Update Rate |
|-------|--------|--------|-------------|
| Aircraft (ADS-B) | OpenSky Network | LIVE | 30s |
| Military Air | ADS-B Exchange (RapidAPI) + OpenSky MIL-DB | LIVE | 30s |
| Maritime AIS | AISStream.io WebSocket | Config Ready | Real-time |
| Dark Fleet | Global Fishing Watch (Gap Events) | LIVE | 30s |
| Fishing Activity | Global Fishing Watch | LIVE | 30s |
| ISS Position | wheretheiss.at + SGP4 Propagation | LIVE | 5s |
| Satellites | N2YO + CelesTrak TLE | LIVE | 3min |
| Space Debris | CelesTrak SGP4 (Fengyun, Cosmos, Iridium) | LIVE | 3min |
| Military Satellites | CelesTrak Military Group | LIVE | 3min |
| Seismic Events | USGS Earthquake API | LIVE | 30s |
| Wildfires | NASA FIRMS VIIRS | LIVE | 30s |
| Storm Systems | OpenWeatherMap (20 cities) | LIVE | 30s |
| Aviation WX | AVWX METAR (15 airports) | LIVE | 30s |
| Conflict Intel | GDELT 2.0 Articles + NewsAPI | LIVE | 30s (staggered) |
| Disasters | GDACS + ReliefWeb | LIVE | 30s |
| Cyber Threats | GDELT Cyber Intel | LIVE | 30s |
| Nuclear Intel | GDELT Nuclear Monitoring | LIVE | 30s |

### Key Features

- **3D WebGL Globe** (G key) — Blue Marble imagery, atmospheric halo, threat-zone pulse rings
- **Event Timeline** (T key) — Auto-populated by all data fetches with severity levels
- **Entity Search** (/ or F) — Full-text across names, callsigns, ICAO codes
- **Keyboard Navigation** — 10+ shortcuts (? for help)
- **Threat Assessment Engine** — Multi-factor scoring (0-100) with 15 geopolitical zones
- **Military Intelligence** — Squawk code decoder, callsign database (MIL_DB), NATO role classification
- **SGP4 Orbital Propagation** — Real-time satellite position calculation from TLE data
- **Multi-Domain Fusion** — Cross-correlates entities across all domains with zone proximity scoring

### Threat Zones (15)

Ukraine/Russia Front, Gaza Strip, Iran Theater, Red Sea/Houthi Zone, Strait of Hormuz, Taiwan Strait, South China Sea, Korean Peninsula, Sudan Civil War, Sahel Insurgency, Kashmir LOC, Black Sea NATO Watch, Horn of Africa, Baltic NATO Frontier, Arctic GIUK Gap

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main application UI |
| `/api/health` | GET | System health check |
| `/api/status` | GET | API key status, target list |
| `/api/proxy` | POST | Secure proxy for keyed APIs |
| `/api/intel/gdelt` | POST | GDELT article geocoding (conflict, maritime, nuclear, cyber) |
| `/api/intel/news` | POST | NewsAPI geocoding (conflict, cyber, nuclear) |
| `/api/weather/global` | GET | OWM multi-city weather (20 cities) |
| `/api/avwx/global` | GET | AVWX multi-airport METAR (15 airports) |
| `/api/reliefweb/disasters` | GET | ReliefWeb disaster data |
| `/api/shodan/search` | POST | Shodan internet exposure |
| `/api/acled/events` | GET | ACLED conflict data |
| `/api/ais/config` | GET | AISStream.io WebSocket config |
| `/api/fusion/zones` | GET | Threat zone definitions |

## Environment Variables

Set in `.dev.vars` for local development, or as Cloudflare secrets for production:

```
NASA_FIRMS_KEY=<your-key>
OWM_KEY=<your-key>
N2YO_KEY=<your-key>
GFW_TOKEN=<your-token>
AVWX_KEY=<your-key>
RAPIDAPI_KEY=<your-key>
SHODAN_KEY=<your-key>
NEWS_API_KEY=<your-key>
AISSTREAM_KEY=<your-key>
ACLED_KEY=<optional-register-at-developer.acleddata.com>
```

## Tech Stack

- **Backend**: Hono v4 on Cloudflare Pages Edge Runtime
- **Frontend**: Vanilla JS, Zero-framework DOM renderer
- **Map**: Leaflet 1.9.4 + MarkerCluster
- **3D Globe**: Globe.gl + Three.js
- **Orbital**: satellite.js (SGP4 propagation)
- **Build**: Vite + Wrangler
- **Dev Server**: PM2 + wrangler pages dev

## Architecture

```
Edge BFF (Backend-for-Frontend) Pattern:
- All keyed API calls route through /api/proxy to protect credentials
- GDELT article-based conflict intel with server-side geocoding
- Multi-city weather aggregation (OWM) and multi-airport METAR (AVWX)
- Staggered GDELT requests to avoid rate-limiting
- Retry logic with exponential backoff for unreliable APIs
```

## Data Flow

1. Frontend boots, initializes Leaflet map + HUD
2. `fetchAll()` runs every 30s, calling 11+ parallel data sources
3. Phase 1: Core feeds (OpenSky, USGS, ISS, FIRMS, OWM, N2YO, GFW, AVWX, Military, GDACS, ReliefWeb)
4. Phase 2: GDELT (staggered 3s apart: conflict -> maritime -> nuclear -> cyber)
5. Phase 3: Supplemental (NewsAPI at +5s, Shodan at +8s)
6. Each parser normalizes data to unified entity format
7. Threat engine scores each entity (0-100) based on type, squawk, zone proximity
8. UI renders entities on map, updates threat board, fusion stats, timeline

## Registration Guidance

### Services Requiring Registration (Free)

- **ACLED**: Register at https://developer.acleddata.com/ — provides conflict event data for 260+ countries
- **ReliefWeb**: Request appname at https://apidoc.reliefweb.int/parameters#appname — UN humanitarian disaster data
- **Shodan (Full Access)**: Upgrade at https://shodan.io/store — internet exposure intelligence (search API requires paid plan; free plan has 0 query credits)

## Deployment

- **Platform**: Cloudflare Pages
- **Status**: Active (sandbox)
- **Version**: 4.0.0
- **Last Updated**: 2026-03-24
