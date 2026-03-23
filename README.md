# SENTINEL OS v2.0

## Global Situational Awareness Platform

A unified Open Source Intelligence (OSINT) Common Operating Picture (COP) inspired by Beholder.me, Palantir Gotham, and NATO C2 systems. Edge-deployed on Cloudflare Pages with Hono framework.

## Architecture

```
CLIENT (Browser)                    EDGE (Cloudflare Workers)
+---------------------------+       +---------------------------+
| Leaflet.js Map            |       | Hono API Proxy            |
| ESRI World Imagery        |  ---> | /api/proxy                |
| Carto Dark Labels         |       |  - OpenSky ADS-B          |
| satellite.js SGP4         |       |  - NASA FIRMS             |
| Marker Clustering         |       |  - OpenWeatherMap         |
| Threat Assessment Engine  |       |  - N2YO Satellites        |
| Military Callsign DB      |       |  - GFW Fishing/Dark Fleet |
| Squawk Intelligence       |       |  - AVWX SIGMETs           |
| 14 Live Data Layers       |       |  - ADS-B Exchange (mil)   |
+---------------------------+       |  - GDELT 2.0 Conflict     |
                                    |  - GDACS Disasters        |
FREE APIs (Direct from client):    |  - ReliefWeb UN OCHA      |
  - USGS Earthquakes               +---------------------------+
  - ISS Position (wheretheiss.at)
  - CelesTrak TLE (7 constellation groups)
  - ReliefWeb Disasters
```

## Live Data Layers (14)

| Layer | Source | Update | Status |
|-------|--------|--------|--------|
| AIRCRAFT | OpenSky ADS-B | 30s | LIVE |
| MILITARY AIR | ADS-B Exchange + Callsign DB | 30s | LIVE |
| MARITIME AIS | MarineTraffic | - | KEY REQUIRED |
| DARK FLEET | GFW Gap Events | 30s | LIVE |
| FISHING | GFW Events API | 30s | LIVE |
| ISS ZARYA | wheretheiss.at | 5s | LIVE |
| SATELLITES | N2YO + CelesTrak SGP4 | 30s/3m | LIVE |
| SPACE DEBRIS | CelesTrak TLE (Fengyun/Cosmos/Iridium) | 3m | LIVE |
| SEISMIC | USGS Earthquake API | 30s | LIVE |
| WILDFIRES | NASA FIRMS VIIRS | 30s | LIVE |
| STORM SYSTEMS | OpenWeatherMap | 30s | LIVE |
| AVIATION WX | AVWX SIGMETs | 30s | LIVE |
| CONFLICT INTEL | GDELT 2.0 Geo API | 30s | LIVE |
| DISASTERS | GDACS + ReliefWeb | 30s | LIVE |

## Intelligence Features

### Threat Assessment Engine
- 12 geopolitical threat zones (Ukraine, Gaza, Red Sea, Hormuz, Taiwan, SCS, Korea, Sudan, Kashmir, Black Sea, E. Med, Horn of Africa)
- Proximity-based scoring with zone-specific base weights
- Multi-factor threat scoring (squawk codes, entity type, magnitude, FRP, proximity)
- 5-level threat classification: CRITICAL / HIGH / MEDIUM / LOW / MINIMAL

### Military Callsign Intelligence
17+ pattern database: RCH/REACH (USAF AMC), JAKE (USN Maritime Patrol), NATO (AEW&C), GHOST (Stealth Strike), VIPER (Air Superiority), BRONC (SIGINT), DUKE (Nuclear C2), BLADE (Carrier Strike), FORTE (HALE ISR), REAPER (UCAV), RAPTOR (5th Gen), ATLAS (RAF Transport), etc.

### Squawk Intelligence
- 7500: HIJACK (CRITICAL)
- 7600: COMMS FAILURE (HIGH)
- 7700: EMERGENCY (CRITICAL)
- 7777: MIL INTERCEPT (HIGH)
- 7400: UAV LOST LINK (HIGH)

### SGP4 Orbital Propagation
- ISS full-orbit ground track (92-minute propagation)
- Space debris tracking (Fengyun-1C, Cosmos 2251, Iridium 33 fragments)
- Constellation tracking (Starlink, GPS, GLONASS, Space Stations)

## Tech Stack

- **Runtime**: Cloudflare Workers (Edge)
- **Framework**: Hono v4
- **Build**: Vite
- **Map**: Leaflet.js + ESRI World Imagery + Carto Dark Labels
- **Clustering**: leaflet.markercluster
- **Orbital**: satellite.js (SGP4/SDP4)
- **Fonts**: Orbitron + Share Tech Mono
- **Deployment**: Cloudflare Pages

## Environment Variables (Cloudflare Secrets)

```
NASA_FIRMS_KEY    - NASA FIRMS fire detection API
OWM_KEY           - OpenWeatherMap API key
N2YO_KEY          - N2YO satellite tracking API
GFW_TOKEN         - Global Fishing Watch bearer token
AVWX_KEY          - AVWX aviation weather API
RAPIDAPI_KEY      - RapidAPI key (ADS-B Exchange military)
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Main SENTINEL OS interface |
| POST | `/api/proxy` | Secure edge proxy for keyed APIs |
| GET | `/api/health` | Health check |
| GET | `/api/status` | API key status |
| GET | `/static/*` | Static assets |

## Local Development

```bash
npm install
npm run build
npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
```

## Deployment

```bash
npm run build
npx wrangler pages deploy dist --project-name sentinel-os
# Set secrets:
npx wrangler pages secret put NASA_FIRMS_KEY --project-name sentinel-os
npx wrangler pages secret put OWM_KEY --project-name sentinel-os
# ... etc
```

## Roadmap

- [ ] 3D WebGL globe mode (Three.js / CesiumJS)
- [ ] MarineTraffic AIS integration
- [ ] Real-time WebSocket data streaming
- [ ] Mission planning / AOI zones
- [ ] Watchlist correlation engine
- [ ] Historical timeline / replay
- [ ] Dark fleet anomaly detection ML
- [ ] AIS spoofing detection
- [ ] SIGINT / RF monitoring overlay
- [ ] Cyber threat geolocation layer

## Status

- **Platform**: Cloudflare Pages Edge Runtime
- **Version**: 2.0.0
- **Status**: OPERATIONAL
- **Last Updated**: 2026-03-23
