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
| Aircraft (ADS-B) | OpenSky Network | LIVE (11,228 states) | 45s |
| Military Air | OpenSky MIL-DB detection | LIVE | 45s |
| Military Air (Enhanced) | ADS-B Exchange (RapidAPI) | Needs subscription | 45s |
| Maritime AIS | AISStream.io WebSocket | Config Ready (key set) | Real-time |
| Dark Fleet | Global Fishing Watch (Gap Events) | LIVE (50 entries) | 45s |
| Fishing Activity | Global Fishing Watch | LIVE (50 entries) | 45s |
| ISS Position | wheretheiss.at + SGP4 Propagation | LIVE | 5s |
| Satellites | N2YO + CelesTrak TLE | LIVE (1,893+) | 3min |
| Space Debris | CelesTrak SGP4 (Fengyun, Cosmos, Iridium) | LIVE | 3min |
| Military Satellites | CelesTrak Military Group | LIVE | 3min |
| Seismic Events | USGS Earthquake API | LIVE | 45s |
| Wildfires | NASA FIRMS VIIRS | LIVE (37,012 hotspots) | 45s |
| Storm Systems | OpenWeatherMap (20 cities) | LIVE | 45s |
| Aviation WX | AVWX METAR (15 airports) | LIVE (14 stations) | 45s |
| Conflict Intel | GDELT 2.0 Articles + NewsAPI | LIVE (72+ geocoded) | 45s (staggered) |
| Disasters | GDACS (100 features) | LIVE | 45s |
| Disasters (Supplemental) | ReliefWeb | Needs appname registration | 45s |
| Cyber Threats | GDELT Cyber Intel | LIVE | 45s |
| Cyber Exposure | Shodan (OSS plan - limited) | Limited | 45s |
| Nuclear Intel | GDELT Nuclear Monitoring | LIVE | 45s |

### Key Features

- **3D WebGL Globe** (G key) — Blue Marble imagery, atmospheric halo, threat-zone pulse rings
- **Event Timeline** (T key) — Auto-populated by all data fetches with severity levels
- **Entity Search** (/ or F) — Full-text across names, callsigns, ICAO codes
- **Keyboard Navigation** — 10+ shortcuts (? for help)
- **Threat Assessment Engine** — Multi-factor scoring (0-100) with 15 geopolitical zones
- **Military Intelligence** — Squawk code decoder, callsign database (MIL_DB), NATO role classification
- **SGP4 Orbital Propagation** — Real-time satellite position calculation from TLE data
- **Multi-Domain Fusion** — Cross-correlates entities across all domains with zone proximity scoring
- **Fetch Cycle Guard** — Prevents overlapping fetch cycles that caused service unresponsiveness

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
| `/api/reliefweb/disasters` | GET | ReliefWeb disaster data (needs registration) |
| `/api/shodan/search` | POST | Shodan internet exposure (host-lookup fallback for free plan) |
| `/api/acled/events` | GET | ACLED conflict data (needs registration) |
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
- Staggered GDELT requests (3s apart) to avoid rate-limiting
- Retry logic with exponential backoff for unreliable APIs
- Fetch cycle guard prevents overlapping request cascades
```

## Data Flow

1. Frontend boots, initializes Leaflet map + HUD
2. `fetchAll()` runs every 45s with overlap guard, calling 11+ parallel data sources
3. Phase 1: Fast feeds (OpenSky, USGS, ISS, FIRMS, OWM, N2YO, AVWX, Military) — renders immediately
4. Phase 2: Slower feeds (GFW, GDACS, ReliefWeb) — renders after completion
5. Phase 3: GDELT (staggered 3s apart: conflict -> maritime -> nuclear -> cyber)
6. Phase 4: Supplemental (NewsAPI at +5s, Shodan at +8s)
7. Each parser normalizes data to unified entity format
8. Threat engine scores each entity (0-100) based on type, squawk, zone proximity
9. UI renders entities on map, updates threat board, fusion stats, timeline

## v4.0.1 Fixes (2026-03-25)

### Critical Bug Fixes
- **GDELT prefix collision** — `replaceLive('gdelt_',...)` was wiping nuclear/cyber data on each conflict refresh. Fixed with specific prefixes: `gdelt_conflict`, `gdelt_nuclear_`, `gdelt_cyber_`, `gdelt_maritime_`
- **Fetch cycle cascading** — 30s interval + slow GDELT (14-24s) caused overlapping cycles that froze the service (588s+ response times). Fixed with `fetchInProgress` guard and increased interval to 45s
- **Shodan exploits API** — Free Shodan exploits endpoint returns HTML not JSON. Replaced with host-lookup fallback strategy using DNS resolve + individual host queries
- **Military ADS-B Exchange 403** — RapidAPI subscription expired. Added graceful handling: logs once on first cycle, falls back silently to OpenSky MIL-DB detection
- **ReliefWeb appname** — All appname strategies rejected (requires registration). Added POST method attempt + clear error messaging. GDACS (100 features) serves as primary disaster feed

### Improvements
- **Phased data loading** — Phase 1 (fast APIs) renders immediately, Phase 2 (slower APIs) renders after completion, Phase 3/4 async
- **API status accuracy** — Updated API reference table to reflect actual service status (ADS-B Exchange: limited, Shodan: limited, ReliefWeb: pending)
- **NewsAPI prefix** — Changed from generic `news_` to `news_conflict_` to avoid entity ID conflicts
- **Cleaner event logging** — Reduced log spam for known limitations (Shodan free plan, ADS-B subscription)

## Registration Guidance

### Services Requiring Registration (Free)

- **ACLED**: Register at https://developer.acleddata.com/ — provides conflict event data for 260+ countries
- **ReliefWeb**: Request appname at https://apidoc.reliefweb.int/parameters#appname — UN humanitarian disaster data (GDACS covers most disaster data meanwhile)
- **Shodan (Full Access)**: Upgrade at https://shodan.io/store — internet exposure intelligence (search API requires paid plan; OSS plan has 0 query credits; host-lookup fallback available)
- **ADS-B Exchange**: Subscribe at https://rapidapi.com/adsbexchange — enhanced military aircraft tracking (OpenSky MIL-DB detection works as free alternative)

## Deployment

- **Platform**: Cloudflare Pages
- **Status**: Active (sandbox)
- **Version**: 4.0.1
- **Last Updated**: 2026-03-25
