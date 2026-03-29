# SENTINEL OS v5.0

## Global Multi-Domain Situational Awareness Platform

Real-time global situational awareness platform aggregating **20+ live OSINT data sources** across aviation, maritime, orbital, seismic, wildfire, weather, conflict, disaster, cyber, nuclear, GPS jamming/EW, and social media intelligence domains.

## Live Platform

- **Sandbox**: https://3000-imtcnhyw0xv31oywd9i92-dfc00ec5.sandbox.novita.ai
- **GitHub**: https://github.com/MSA-83/SENTINEL-X

## Features

### Live Data Layers (20+)

| Layer | Source | Status | Domain |
|-------|--------|--------|--------|
| Aircraft (ADS-B) | OpenSky Network | LIVE | Aviation |
| Military Air | OpenSky MIL-DB + ADS-B Exchange | LIVE | Aviation |
| Maritime AIS | AISStream.io WebSocket | Config Ready | Maritime |
| Dark Fleet | Global Fishing Watch (Gap Events) | LIVE | Maritime |
| Fishing Activity | Global Fishing Watch | LIVE | Maritime |
| ISS Position | wheretheiss.at + SGP4 | LIVE (5s cycle) | Orbital |
| Satellites | N2YO + CelesTrak TLE | LIVE | Orbital |
| Space Debris | CelesTrak SGP4 | LIVE | Orbital |
| Military Satellites | CelesTrak Military | LIVE | Orbital |
| Seismic Events | USGS Earthquake API | LIVE | Environmental |
| Wildfires | NASA FIRMS VIIRS | LIVE | Environmental |
| Storm Systems | OpenWeatherMap (20 cities) | LIVE | Environmental |
| Aviation WX | AVWX METAR (15 airports) | LIVE | Environmental |
| Conflict Intel | GDELT 2.0 + NewsAPI | LIVE | Geopolitical |
| Disasters | GDACS + ReliefWeb | LIVE | Environmental |
| **Cyber Threats** | **AlienVault OTX + URLhaus + ThreatFox + Shodan + GDELT** | **NEW v5.0** | **Cyber** |
| Nuclear Intel | GDELT Nuclear Monitoring | LIVE | WMD |
| **GPS Jamming** | **GPSJam.org curated + Eurocontrol + EASA + OPSGROUP** | **NEW v5.0** | **EW/SIGINT** |
| **Social OSINT** | **Reddit (CombatFootage, UkraineWar, CredibleDefense, OSINT)** | **NEW v5.0** | **Social Media** |

### v5.0 New Layers

#### 1. Enhanced Cybersecurity Layer
- **AlienVault OTX** — Community threat intelligence with 200K+ participants. IOC feeds, adversary tracking, malware families, MITRE ATT&CK mapping.
  - **Get API Key**: Free registration at https://otx.alienvault.com/
- **URLhaus (abuse.ch)** — Malware URL tracking. No API key required. Tracks active malware distribution sites globally.
  - **Direct Access**: https://urlhaus.abuse.ch/
- **ThreatFox (abuse.ch)** — Indicators of Compromise (IOC) feed. No API key required. Tracks malware families, C2 servers, payload hashes.
  - **Direct Access**: https://threatfox.abuse.ch/
- **Shodan** — Internet exposure intelligence (existing, enhanced integration)
- **GDELT Cyber** — Cyberattack news intelligence (existing)

#### 2. GPS Jamming Anomalies Layer
- **15 curated GPS jamming/spoofing hotspots** with severity ratings (Critical/High/Medium/Low)
- Sources: GPSJam.org (ADS-B NIC/NAC data), Eurocontrol GNSS reports, EASA safety bulletins, C4ADS research, OPSGROUP pilot reports
- Covers: Military EW jamming (Krasukha-4, Pole-21), GPS spoofing near conflict zones, maritime chokepoint interference
- Key zones: Ukraine Eastern Front, Kaliningrad/Baltic, Syria, Israel/Ben Gurion, Black Sea, North Korea DMZ, South China Sea
- **Free monitoring**: https://gpsjam.org/ (daily maps), https://www.flightradar24.com/data/gps-jamming

#### 3. Social Media Conflict OSINT Layer
- **Reddit public JSON API** (no authentication required for public subreddits)
- Subreddits monitored: r/CombatFootage, r/UkraineWarVideoReport, r/CredibleDefense, r/UkrainianConflict, r/osint
- Features: Automatic geocoding from post titles, video link extraction (Reddit video, YouTube, Twitter/X, Streamable), score/comment ranking
- Posts placed on map based on GPS metadata from title geocoding
- Video links accessible in entity inspector panel

### Key Features

- **3D WebGL Globe** (G key) — Blue Marble imagery, atmospheric halo, threat-zone pulse rings
- **Event Timeline** (T key) — Auto-populated by all data fetches with severity levels
- **Entity Search** (/ or F) — Full-text across names, callsigns, ICAO codes
- **Keyboard Navigation** — 10+ shortcuts (? for help)
- **Threat Assessment Engine** — Multi-factor scoring (0-100) with 15 geopolitical zones
- **Military Intelligence** — Squawk code decoder, callsign database (MIL_DB), NATO role classification
- **SGP4 Orbital Propagation** — Real-time satellite position calculation from TLE data
- **Multi-Domain Fusion** — Cross-correlates entities across all 12 domains
- **GEO_DB** — 91 geopolitical location entries for article/post geocoding

### Threat Zones (15)

Ukraine/Russia Front, Gaza Strip, Iran Theater, Red Sea/Houthi Zone, Strait of Hormuz, Taiwan Strait, South China Sea, Korean Peninsula, Sudan Civil War, Sahel Insurgency, Kashmir LOC, Black Sea NATO Watch, Horn of Africa, Baltic NATO Frontier, Arctic GIUK Gap

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main application UI |
| `/api/health` | GET | System health check (v5.0.0, 12 domains) |
| `/api/status` | GET | API key status, targets, GPS zones, GEO entries |
| `/api/proxy` | POST | Secure proxy for keyed APIs |
| `/api/intel/gdelt` | POST | GDELT article geocoding (conflict, maritime, nuclear, cyber) |
| `/api/intel/news` | POST | NewsAPI geocoding (conflict, cyber, nuclear, gpsjam) |
| `/api/weather/global` | GET | OWM multi-city weather (20 cities) |
| `/api/avwx/global` | GET | AVWX multi-airport METAR (15 airports) |
| `/api/reliefweb/disasters` | GET | ReliefWeb disaster data (50 entries) |
| `/api/shodan/search` | POST | Shodan internet exposure |
| `/api/acled/events` | GET | ACLED conflict data |
| `/api/ais/config` | GET | AISStream.io WebSocket config |
| `/api/fusion/zones` | GET | Threat zone definitions |
| `/api/cyber/otx` | GET | **NEW** AlienVault OTX threat pulses |
| `/api/cyber/urlhaus` | GET | **NEW** URLhaus malware URL feed |
| `/api/cyber/threatfox` | GET | **NEW** ThreatFox IOC feed |
| `/api/gps/jamming` | GET | **NEW** GPS jamming hotspots (15 zones) + GDELT GPS news |
| `/api/social/reddit` | GET | **NEW** Reddit OSINT conflict posts |

## Environment Variables

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
OTX_KEY=<optional-register-at-otx.alienvault.com>
REDDIT_CLIENT_ID=<optional-for-enhanced-access>
REDDIT_SECRET=<optional-for-enhanced-access>
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
- All keyed API calls route through /api/proxy
- Dedicated endpoints for each new layer (OTX, URLhaus, ThreatFox, GPS, Reddit)
- 91 GEO_DB entries for article/post geocoding
- 15 curated GPS jamming zones with severity ratings
- Phased data loading: 5 phases from core feeds to supplemental
```

## Data Flow

1. Frontend boots, initializes Leaflet map + HUD
2. `fetchAll()` runs every 60s with overlap guard
3. Phase 1: Core feeds (OpenSky, USGS, ISS, FIRMS, OWM, N2YO, AVWX, Military)
4. Phase 2: Slower feeds (GFW, GDACS, ReliefWeb, GPS Jamming)
5. Phase 3: GDELT intel (conflict+maritime parallel, then nuclear+cyber)
6. Phase 4: Cyber feeds (OTX at +2s, URLhaus at +3s, ThreatFox at +4s)
7. Phase 5: Supplemental (NewsAPI at +5s, Shodan at +6s, Reddit Social at +7s)

## Registration Guidance (Free Services)

| Service | URL | Purpose |
|---------|-----|---------|
| AlienVault OTX | https://otx.alienvault.com/ | Cyber threat intelligence API key |
| ACLED | https://developer.acleddata.com/ | Conflict event data |
| Shodan (Full) | https://shodan.io/store | Internet exposure search |
| ADS-B Exchange | https://rapidapi.com/adsbexchange | Military aircraft tracking |
| GPSJam.org | https://gpsjam.org/ | GPS interference daily maps |
| URLhaus | https://urlhaus.abuse.ch/ | Malware URL tracking (no key needed) |
| ThreatFox | https://threatfox.abuse.ch/ | IOC feed (no key needed) |
| Flightradar24 GPS | https://www.flightradar24.com/data/gps-jamming | GPS jamming map |

## Changelog

### v5.0.0 (2026-03-29)

#### New Layers
- **Cybersecurity (Enhanced)**: Added AlienVault OTX (threat pulses, IOCs, MITRE ATT&CK), URLhaus (malware URLs), ThreatFox (IOC feed) — all free, no key required for basic access
- **GPS Jamming Anomalies**: 15 curated hotspots from GPSJam.org, Eurocontrol, EASA, C4ADS, OPSGROUP with severity ratings and confidence scores + GDELT GPS news enrichment + visual radius circles on map
- **Social Media Conflict OSINT**: Reddit integration (5 subreddits), automatic geocoding, video link extraction, score ranking

#### Improvements
- GEO_DB expanded from ~60 to 91 entries (added Baltic, Arctic, cyber-relevant locations)
- Threat scoring enhanced for GPS jamming (+20) and social media (+10) entities
- Frontend layer count: 20+ layers across 12 domains
- HUD stats ring shows GPS and SOC counters
- Phased loading extended to 5 phases for optimal UX

#### Bug Fixes (v5.0.0)
- Fixed Shodan fallback logic (removed unused `searchFailed` variable)
- Fixed OTX API triple-fallback (subscribed → activity → search)
- Fixed Reddit User-Agent to avoid 429 rate limiting
- Added GPS jamming zone radius circles with severity coloring
- GPS jamming circles properly toggle with layer visibility
- Added GDELT GPS news enrichment to jamming endpoint

### v4.0.2 (2026-03-25)
- GDELT timeout/retry reduction, parallel fetch, cycle cooldown
- Shodan JSON parse crash fix, CelesTrak prefix collision fix

### v4.0.1 (2026-03-25)
- GDELT prefix collision, fetch cascade, Shodan/ADS-B fallbacks

## Deployment

- **Platform**: Cloudflare Pages
- **Status**: Active (sandbox)
- **Version**: 5.0.0
- **Last Updated**: 2026-03-29
